import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMcpServer } from "../server/src/mcp-server.js";
import { PairingStore } from "../server/src/pairing-store.js";
import { PluginGateway } from "../server/src/plugin-gateway.js";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const PNG_BYTE_LENGTH = Buffer.from(PNG_BASE64, "base64").byteLength;
const FINGERPRINT = "a".repeat(64);

const expectedTools = [
  "mat_figma_status",
  "mat_figma_pairing_code",
  "mat_figma_get_selection",
  "mat_figma_get_node",
  "mat_figma_list_fonts",
  "mat_figma_list_text_styles",
  "mat_figma_audit_typography",
  "mat_figma_export_preview",
  "mat_figma_propose_typography_patch",
  "mat_figma_get_patch_status",
  "mat_figma_cancel_patch",
].sort();

function appliedPatchStatus(options: {
  previewData?: string | undefined;
  previewMimeType?: string;
  previewByteLength?: number;
} = {}) {
  return {
    patchId: "patch-1",
    approvalDigest: FINGERPRINT,
    status: "applied",
    updatedAt: 1_000,
    summary: {
      patchId: "patch-1",
      title: "Normalize MAT typography",
      detail: "Apply the approved MAT typography batch.",
      operationCount: 1,
      styleChanges: 0,
      nodeChanges: 1,
      globalStyleUpdates: 0,
      impactedNodes: 1,
      expiresAt: 300_000,
      warnings: [],
      operationDetails: ["Bind MAT body text to the approved local style."],
      affectedNodes: [
        {
          id: "375:12",
          name: "MAT Foundations",
          nameTruncated: false,
          type: "FRAME",
          pageId: "66:11",
          pageName: "MAT — Foundations",
        },
      ],
      previewTarget: {
        nodeId: "375:12",
        name: "MAT Foundations",
        maxDimension: 1_280,
      },
    },
    result: {
      operationCount: 1,
      affectedNodeIds: ["375:12"],
      dimensionChanges: [],
      createdStyleIds: [],
      createdNodeIds: [],
      warnings: [],
      affectedNodes: [
        {
          id: "375:12",
          name: "MAT Foundations",
          nameTruncated: false,
          type: "FRAME",
          pageId: "66:11",
          pageName: "MAT — Foundations",
        },
      ],
      postApplyPreview: {
        mimeType: options.previewMimeType ?? "image/png",
        width: 1,
        height: 1,
        byteLength: options.previewByteLength ?? PNG_BYTE_LENGTH,
        nodeId: "375:12",
        fingerprint: FINGERPRINT,
      },
      undo: {
        state: "available",
        expiresAt: 300_000,
      },
    },
    ...(options.previewData === undefined
      ? {}
      : { postApplyPreviewData: options.previewData }),
  };
}

describe("MCP server contract", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.allSettled(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  async function connect(
    gateway = new PluginGateway(new PairingStore("unused-test-path")),
  ) {
    const server = createMcpServer(gateway);
    const client = new Client({ name: "bridge-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    cleanups.push(async () => {
      await Promise.allSettled([client.close(), server.close()]);
    });
    return client;
  }

  it("advertises exactly the eleven bounded tools", async () => {
    const client = await connect();
    const response = await client.listTools();
    expect(response.tools.map((tool) => tool.name).sort()).toEqual(expectedTools);

    const statusTool = response.tools.find(
      (tool) => tool.name === "mat_figma_status",
    );
    expect(statusTool?.outputSchema).toMatchObject({
      type: "object",
      properties: {
        ok: { type: "boolean" },
        data: {
          type: "object",
          properties: {
            bridge: {
              type: "object",
              properties: {
                endpoint: { type: "string" },
                connected: { type: "boolean" },
              },
            },
          },
        },
      },
    });
  });

  it("returns a structured local status while Figma is disconnected", async () => {
    const client = await connect();
    const response = await client.callTool({
      name: "mat_figma_status",
      arguments: {},
    });

    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: {
        bridge: {
          listening: false,
          connected: false,
          paired: false,
        },
        plugin: null,
      },
    });
  });

  it("returns the same unexpired pairing code through structured output", async () => {
    const client = await connect();
    const first = await client.callTool({
      name: "mat_figma_pairing_code",
      arguments: {},
    });
    const second = await client.callTool({
      name: "mat_figma_pairing_code",
      arguments: {},
    });

    const firstData = (
      first.structuredContent as {
        data: { code: string; expiresAt: string };
      }
    ).data;
    const secondData = (
      second.structuredContent as {
        data: { code: string; expiresAt: string };
      }
    ).data;
    expect(firstData.code).toMatch(/^\d{6}$/);
    expect(secondData).toEqual(firstData);
  });

  it("returns an applied patch preview as MCP image content without embedding its base64 in structured output", async () => {
    const gateway = {
      request: vi.fn().mockResolvedValue(
        appliedPatchStatus({ previewData: PNG_BASE64 }),
      ),
    } as unknown as PluginGateway;
    const client = await connect(gateway);

    const response = await client.callTool({
      name: "mat_figma_get_patch_status",
      arguments: { patchId: "patch-1", waitMs: 0 },
    });
    const content = response.content as CallToolResult["content"];

    expect(response.isError).not.toBe(true);
    expect(
      (gateway.request as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[2],
    ).not.toHaveProperty("timeoutMs");
    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: {
        patchId: "patch-1",
        status: "applied",
        result: {
          postApplyPreview: {
            mimeType: "image/png",
            byteLength: PNG_BYTE_LENGTH,
            nodeId: "375:12",
          },
        },
      },
    });
    expect(
      (
        response.structuredContent as {
          data: { postApplyPreviewData?: unknown };
        }
      ).data.postApplyPreviewData,
    ).toBeUndefined();
    expect(content).toContainEqual({
      type: "image",
      data: PNG_BASE64,
      mimeType: "image/png",
    });
    expect(JSON.stringify(response.structuredContent)).not.toContain(PNG_BASE64);
    expect(
      content.find((item) => item.type === "text"),
    ).toEqual(
      expect.objectContaining({
        text: expect.not.stringContaining(PNG_BASE64),
      }),
    );
  });

  it.each([
    ["missing base64 data", appliedPatchStatus()],
    [
      "non-base64 data",
      appliedPatchStatus({ previewData: "not-base64!" }),
    ],
    [
      "a byte-length mismatch",
      appliedPatchStatus({
        previewData: PNG_BASE64,
        previewByteLength: PNG_BYTE_LENGTH + 1,
      }),
    ],
    [
      "a non-PNG MIME type",
      appliedPatchStatus({
        previewData: PNG_BASE64,
        previewMimeType: "image/jpeg",
      }),
    ],
  ])("rejects an applied preview with %s", async (_label, status) => {
    const gateway = {
      request: vi.fn().mockResolvedValue(status),
    } as unknown as PluginGateway;
    const client = await connect(gateway);

    const response = await client.callTool({
      name: "mat_figma_get_patch_status",
      arguments: { patchId: "patch-1", waitMs: 0 },
    });
    const content = response.content as CallToolResult["content"];

    expect(response.isError).toBe(true);
    expect(response.structuredContent).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_PLUGIN_RESPONSE",
      },
    });
    expect(content.some((item) => item.type === "image")).toBe(false);
  });
});
