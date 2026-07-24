import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import { createMcpServer } from "../server/src/mcp-server.js";
import { PairingStore } from "../server/src/pairing-store.js";
import { PluginGateway } from "../server/src/plugin-gateway.js";

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

describe("MCP server contract", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.allSettled(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  async function connect() {
    const gateway = new PluginGateway(new PairingStore("unused-test-path"));
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
});
