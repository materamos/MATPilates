import { randomUUID } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";

import {
  buildPatchProposal,
  PreviewResultSchema,
  ToolDataSchemas,
  ToolInputs,
  ToolOutputSchemas,
  type ResultEnvelope,
} from "../../shared/protocol.js";
import { BridgeError, toBridgeError } from "./errors.js";
import type { PluginGateway } from "./plugin-gateway.js";

const readOnlyAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const internalWriteAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

const PreviewResponseSchema = PreviewResultSchema
  .superRefine((preview, context) => {
    const decoded = Buffer.from(preview.data, "base64");
    if (
      decoded.byteLength !== preview.byteLength ||
      decoded.toString("base64") !== preview.data
    ) {
      context.addIssue({
        code: "custom",
        path: ["data"],
        message: "Preview base64 does not match its declared byte length.",
      });
    }
  });

function toolResult(
  envelope: ResultEnvelope,
  extraContent: CallToolResult["content"] = [],
): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(envelope),
      },
      ...extraContent,
    ],
    structuredContent: envelope,
    ...(!envelope.ok ? { isError: true } : {}),
  };
}

function patchIsTerminal(value: unknown): boolean {
  if (!value || typeof value !== "object" || !("status" in value)) {
    return true;
  }
  return !["pending_approval", "applying"].includes(
    String((value as { status: unknown }).status),
  );
}

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new BridgeError("REQUEST_CANCELLED", "The request was cancelled."));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new BridgeError("REQUEST_CANCELLED", "The request was cancelled."));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function runTool(
  dataSchema: z.ZodType,
  action: () => Promise<unknown> | unknown,
): Promise<CallToolResult> {
  try {
    return toolResult({ ok: true, data: dataSchema.parse(await action()) });
  } catch (error) {
    const bridgeError = toBridgeError(
      error instanceof z.ZodError
        ? new BridgeError(
            "INVALID_PLUGIN_RESPONSE",
            "The bridge received or produced invalid structured data.",
            { cause: error },
          )
        : error,
    );
    return toolResult({
      ok: false,
      error: {
        code: bridgeError.code,
        message: bridgeError.message,
        retryable: bridgeError.retryable,
        ...(bridgeError.correlationId
          ? { correlationId: bridgeError.correlationId }
          : {}),
      },
    });
  }
}

export function createMcpServer(gateway: PluginGateway): McpServer {
  const server = new McpServer(
    {
      name: "@mat-pilates/figma-local-bridge",
      version: "0.1.0",
    },
    {
      instructions:
        "Use this local bridge only for font-sensitive Figma typography. Inspect status and local fonts first. Reads are safe. A proposed patch never writes by itself: the user must review and press Aplicar in Figma Desktop. Use exact IDs and fresh fingerprints, poll patch status, then re-audit the exact scope. Never substitute Neue Montreal weights; only Regular, Medium, and Bold are supported.",
    },
  );

  server.registerTool(
    "mat_figma_status",
    {
      title: "MAT Figma bridge status",
      description:
        "Report local bridge, pairing, and Figma Desktop plugin status without changing the document.",
      inputSchema: ToolInputs.status,
      outputSchema: ToolOutputSchemas.status,
      annotations: readOnlyAnnotations,
    },
    async (_input, extra) =>
      runTool(ToolDataSchemas.status, async () => {
        const bridge = gateway.status();
        const plugin = bridge.connected
          ? await gateway.request("status", {}, { signal: extra.signal })
          : null;
        return { bridge, plugin };
      }),
  );

  server.registerTool(
    "mat_figma_pairing_code",
    {
      title: "Create Figma pairing code",
      description:
        "Return the current six-digit, five-minute pairing code for the local Figma Desktop plugin. Reuses an unexpired code.",
      inputSchema: ToolInputs.pairingCode,
      outputSchema: ToolOutputSchemas.pairingCode,
      annotations: {
        ...internalWriteAnnotations,
        idempotentHint: true,
      },
    },
    async () =>
      runTool(ToolDataSchemas.pairingCode, () => gateway.getPairingCode()),
  );

  server.registerTool(
    "mat_figma_get_selection",
    {
      title: "Inspect the Figma selection",
      description:
        "Read exact selected nodes and typography from the open Figma Desktop file. Text content is omitted unless requested.",
      inputSchema: ToolInputs.getSelection,
      outputSchema: ToolOutputSchemas.getSelection,
      annotations: readOnlyAnnotations,
    },
    async (input, extra) =>
      runTool(ToolDataSchemas.getSelection, () =>
        gateway.request("get_selection", input, { signal: extra.signal }),
      ),
  );

  server.registerTool(
    "mat_figma_get_node",
    {
      title: "Inspect one Figma node",
      description:
        "Read one exact node by ID, including its current fingerprint and optional text content.",
      inputSchema: ToolInputs.getNode,
      outputSchema: ToolOutputSchemas.getNode,
      annotations: readOnlyAnnotations,
    },
    async (input, extra) =>
      runTool(ToolDataSchemas.getNode, () =>
        gateway.request("get_node", input, { signal: extra.signal }),
      ),
  );

  server.registerTool(
    "mat_figma_list_fonts",
    {
      title: "List Figma Desktop fonts",
      description:
        "List fonts visible to the local Figma Desktop runtime, optionally filtered by family. This is the authoritative local-font check.",
      inputSchema: ToolInputs.listFonts,
      outputSchema: ToolOutputSchemas.listFonts,
      annotations: readOnlyAnnotations,
    },
    async (input, extra) =>
      runTool(ToolDataSchemas.listFonts, () =>
        gateway.request("list_fonts", input, { signal: extra.signal }),
      ),
  );

  server.registerTool(
    "mat_figma_list_text_styles",
    {
      title: "List local Figma text styles",
      description:
        "List local text styles, exact typography values, and fingerprints in the open Figma file.",
      inputSchema: ToolInputs.listTextStyles,
      outputSchema: ToolOutputSchemas.listTextStyles,
      annotations: readOnlyAnnotations,
    },
    async (_input, extra) =>
      runTool(ToolDataSchemas.listTextStyles, () =>
        gateway.request("list_text_styles", {}, { signal: extra.signal }),
      ),
  );

  server.registerTool(
    "mat_figma_audit_typography",
    {
      title: "Audit Figma typography",
      description:
        "Audit typography in the current selection, one node subtree, or current page. Returns local-style links, font usage, mixed ranges, and fingerprints without writing.",
      inputSchema: ToolInputs.auditTypography,
      outputSchema: ToolOutputSchemas.auditTypography,
      annotations: readOnlyAnnotations,
    },
    async (input, extra) =>
      runTool(ToolDataSchemas.auditTypography, () =>
        gateway.request("audit_typography", input, { signal: extra.signal }),
      ),
  );

  server.registerTool(
    "mat_figma_export_preview",
    {
      title: "Export a local Figma preview",
      description:
        "Export one exact Figma node as a bounded PNG from Figma Desktop. The image is returned to Codex and is not persisted by the bridge.",
      inputSchema: ToolInputs.exportPreview,
      outputSchema: ToolOutputSchemas.exportPreview,
      annotations: readOnlyAnnotations,
    },
    async (input, extra) => {
      try {
        const response = PreviewResponseSchema.parse(
          await gateway.request("export_preview", input, {
            signal: extra.signal,
          }),
        );
        const { data, ...metadata } = response;
        return toolResult(
          { ok: true, data: metadata },
          [{ type: "image", data, mimeType: "image/png" }],
        );
      } catch (error) {
        const bridgeError = toBridgeError(
          error instanceof z.ZodError
            ? new BridgeError(
                "INVALID_PLUGIN_RESPONSE",
                "Figma returned an invalid preview.",
                { cause: error },
              )
            : error,
        );
        return toolResult({
          ok: false,
          error: {
            code: bridgeError.code,
            message: bridgeError.message,
            retryable: bridgeError.retryable,
            ...(bridgeError.correlationId
              ? { correlationId: bridgeError.correlationId }
              : {}),
          },
        });
      }
    },
  );

  server.registerTool(
    "mat_figma_propose_typography_patch",
    {
      title: "Propose an approved typography patch",
      description:
        "Send an exact, fingerprint-protected typography batch to the local Figma plugin. This only opens a Spanish review prompt; Figma changes occur only after the user presses Aplicar.",
      inputSchema: ToolInputs.proposePatch,
      outputSchema: ToolOutputSchemas.proposePatch,
      annotations: internalWriteAnnotations,
    },
    async (input, extra) =>
      runTool(ToolDataSchemas.proposePatch, async () => {
        const proposal = buildPatchProposal(input, {
          patchId: randomUUID(),
          clientRequestId: randomUUID(),
        });
        const acknowledgement = await gateway.request(
          "propose_patch",
          proposal,
          { signal: extra.signal },
        );
        return { proposal, acknowledgement };
      }),
  );

  server.registerTool(
    "mat_figma_get_patch_status",
    {
      title: "Get typography patch status",
      description:
        "Poll or briefly wait for the user's manual decision and the resulting apply/rollback status.",
      inputSchema: ToolInputs.getPatchStatus,
      outputSchema: ToolOutputSchemas.getPatchStatus,
      annotations: readOnlyAnnotations,
    },
    async (input, extra) =>
      runTool(ToolDataSchemas.getPatchStatus, async () => {
        const deadline = Date.now() + input.waitMs;
        let status = await gateway.request(
          "get_patch_status",
          { patchId: input.patchId, waitMs: 0 },
          { signal: extra.signal, timeoutMs: 5_000 },
        );
        while (!patchIsTerminal(status) && Date.now() < deadline) {
          await wait(Math.min(250, deadline - Date.now()), extra.signal);
          status = await gateway.request(
            "get_patch_status",
            { patchId: input.patchId, waitMs: 0 },
            { signal: extra.signal, timeoutMs: 5_000 },
          );
        }
        return status;
      }),
  );

  server.registerTool(
    "mat_figma_cancel_patch",
    {
      title: "Cancel a pending typography patch",
      description:
        "Cancel the exact pending patch before application. It cannot cancel or undo an applied batch.",
      inputSchema: ToolInputs.cancelPatch,
      outputSchema: ToolOutputSchemas.cancelPatch,
      annotations: {
        ...internalWriteAnnotations,
        idempotentHint: true,
      },
    },
    async (input, extra) =>
      runTool(ToolDataSchemas.cancelPatch, () =>
        gateway.request("cancel_patch", input, { signal: extra.signal }),
      ),
  );

  return server;
}
