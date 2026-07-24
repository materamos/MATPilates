import {
  PROTOCOL_VERSION,
  ToolInputs,
  bridgeRequestSchema,
  bridgeResponseSchema,
  publicErrorCodeForInternalCode,
  typographyPatchSchema,
  type BridgeRequest,
  type BridgeResponse,
  type MainToUiMessage,
  type PatchStatusSnapshot,
  type UiToMainMessage,
} from "./contracts";
import { inspectFontAvailability } from "./font-policy";
import {
  auditTypography,
  exportPreview,
  getNodeSnapshot,
  getPluginStatus,
  getSelectionSnapshot,
  listLocalTextStyles,
} from "./inspection";
import { PatchEngine, toBridgeError } from "./patch-engine";

declare const __html__: string;

const AUTH_TOKEN_KEY = "mat-figma-bridge.auth-token.v1";
const INSTALLATION_ID_KEY = "mat-figma-bridge.installation-id.v1";
const UI_WIDTH = 390;
const UI_HEIGHT = 620;
let uiMessageQueue: Promise<void> = Promise.resolve();

const patchEngine = new PatchEngine((patch) => {
  if (patch.status === "pending_approval") {
    figma.ui.show();
  }
  postToUi({ type: "patch_status", patch });
});

figma.showUI(__html__, {
  width: UI_WIDTH,
  height: UI_HEIGHT,
  themeColors: true,
  title: "MAT — Codex Bridge",
});

figma.ui.onmessage = (rawMessage: unknown) => {
  uiMessageQueue = uiMessageQueue.then(
    () => handleUiMessage(rawMessage),
    () => handleUiMessage(rawMessage),
  );
};

figma.on("selectionchange", () => {
  void publishPluginStatus();
});

figma.on("currentpagechange", () => {
  void publishPluginStatus();
});

async function handleUiMessage(rawMessage: unknown): Promise<void> {
  if (!isUiMessage(rawMessage)) {
    postToUi({
      type: "ui_error",
      error: {
        code: "INVALID_UI_MESSAGE",
        message: "El plugin recibió un mensaje de interfaz no válido.",
      },
    });
    return;
  }

  try {
    switch (rawMessage.type) {
      case "ui_ready":
        await sendBootstrap();
        return;

      case "bridge_request":
        await handleBridgeRequest(rawMessage.request);
        return;

      case "store_token":
        if (
          rawMessage.token.length < 32 ||
          rawMessage.token.length > 256
        ) {
          throw pluginError(
            "INVALID_AUTH_TOKEN",
            "El servidor devolvió un token no válido.",
          );
        }
        await figma.clientStorage.setAsync(AUTH_TOKEN_KEY, rawMessage.token);
        postToUi({ type: "token_stored" });
        return;

      case "clear_token":
        await figma.clientStorage.deleteAsync(AUTH_TOKEN_KEY);
        postToUi({ type: "token_cleared" });
        return;

      case "approve_patch":
        await patchEngine.approve(
          rawMessage.patchId,
          rawMessage.approvalDigest,
        );
        return;

      case "reject_patch":
        patchEngine.reject(rawMessage.patchId);
        return;

      case "hide_ui":
        figma.ui.hide();
        return;

      case "refresh_status":
        await publishPluginStatus();
        return;
    }
  } catch (error) {
    postToUi({
      type: "ui_error",
      error: toBridgeError(error),
    });
  }
}

async function handleBridgeRequest(rawRequest: BridgeRequest): Promise<void> {
  const parsed = bridgeRequestSchema.safeParse(rawRequest);
  if (!parsed.success) {
    const unsafeId =
      typeof rawRequest === "object" &&
      rawRequest !== null &&
      "id" in rawRequest &&
      typeof rawRequest.id === "string"
        ? rawRequest.id.slice(0, 128)
        : "invalid-request";
    postToUi({
      type: "bridge_response",
      response: errorResponse(
        unsafeId,
        "INVALID_PLUGIN_REQUEST",
        "La solicitud del servidor no cumple el protocolo.",
      ),
    });
    return;
  }

  const request = parsed.data;
  try {
    const result = await dispatchBridgeRequest(request);
    postToUi({
      type: "bridge_response",
      response: bridgeResponseSchema.parse({
        v: PROTOCOL_VERSION,
        type: "response",
        id: request.id,
        ok: true,
        result,
      }),
    });
  } catch (error) {
    const technicalError = toBridgeError(error);
    postToUi({
      type: "bridge_response",
      response: errorResponse(
        request.id,
        technicalError.code,
        technicalError.message,
      ),
    });
  }
}

async function dispatchBridgeRequest(request: BridgeRequest): Promise<unknown> {
  switch (request.method) {
    case "status": {
      ToolInputs.status.parse(request.payload);
      return statusWithPatch();
    }

    case "get_selection": {
      const input = ToolInputs.getSelection.parse(request.payload);
      return getSelectionSnapshot(input.includeCharacters);
    }

    case "get_node": {
      const input = ToolInputs.getNode.parse(request.payload);
      return getNodeSnapshot(input.nodeId, input.includeCharacters);
    }

    case "list_fonts": {
      const input = ToolInputs.listFonts.parse(request.payload);
      const fonts = await inspectFontAvailability();
      return {
        family: "Neue Montreal",
        fonts:
          input.family !== undefined && input.family !== "Neue Montreal"
            ? []
            : fonts.map(({ role, fontName, available }) => ({
                role,
                family: fontName.family,
                style: fontName.style,
                available,
              })),
      };
    }

    case "list_text_styles": {
      ToolInputs.listTextStyles.parse(request.payload);
      return { styles: await listLocalTextStyles() };
    }

    case "audit_typography": {
      const input = ToolInputs.auditTypography.parse(request.payload);
      return auditTypography(input);
    }

    case "export_preview": {
      const input = ToolInputs.exportPreview.parse(request.payload);
      return exportPreview(input.nodeId, input.maxDimension);
    }

    case "propose_patch": {
      const patch = typographyPatchSchema.parse(request.payload);
      return patchEngine.propose(patch);
    }

    case "get_patch_status": {
      const input = ToolInputs.getPatchStatus.parse(request.payload);
      const status = patchEngine.getStatus(input.patchId);
      if (status === null) {
        throw pluginError(
          "PATCH_STATUS_NOT_FOUND",
          `No se encontró el lote ${input.patchId}.`,
        );
      }
      return status;
    }

    case "cancel_patch": {
      const input = ToolInputs.cancelPatch.parse(request.payload);
      return patchEngine.cancel(input.patchId);
    }
  }
}

async function sendBootstrap(): Promise<void> {
  const [token, installationId, status] = await Promise.all([
    getStoredToken(),
    getOrCreateInstallationId(),
    statusWithPatch(),
  ]);
  postToUi({
    type: "bootstrap",
    token,
    pluginInstallationId: installationId,
    status,
    pendingPatch: patchEngine.getPendingStatus(),
  });
}

async function publishPluginStatus(): Promise<void> {
  try {
    postToUi({
      type: "plugin_status",
      status: await statusWithPatch(),
    });
  } catch (error) {
    postToUi({
      type: "ui_error",
      error: toBridgeError(error),
    });
  }
}

async function statusWithPatch(): Promise<unknown> {
  return {
    ...(await getPluginStatus()),
    pendingPatch: patchEngine.getPendingStatus(),
    latestPatch: patchEngine.getStatus(),
    writeBlocked: patchEngine.isWriteBlocked(),
  };
}

async function getStoredToken(): Promise<string | null> {
  const token = await figma.clientStorage.getAsync(AUTH_TOKEN_KEY);
  return typeof token === "string" && token.length >= 32 && token.length <= 256
    ? token
    : null;
}

async function getOrCreateInstallationId(): Promise<string> {
  const existing = await figma.clientStorage.getAsync(INSTALLATION_ID_KEY);
  if (typeof existing === "string" && existing.length >= 16) {
    return existing;
  }
  const installationId = createInstallationId();
  await figma.clientStorage.setAsync(INSTALLATION_ID_KEY, installationId);
  return installationId;
}

function createInstallationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 0x1_0000_0000)
      .toString(16)
      .padStart(8, "0"),
  ).join("");
  return `figma-${timestamp}-${random}`;
}

function errorResponse(
  requestId: string,
  internalCode: string,
  message: string,
): BridgeResponse {
  const code = publicErrorCodeForInternalCode(internalCode);
  return {
    v: PROTOCOL_VERSION,
    type: "response",
    id: requestId,
    ok: false,
    error: {
      code,
      message,
      retryable:
        code === "PLUGIN_DISCONNECTED" ||
        code === "REQUEST_TIMEOUT" ||
        code === "FONT_UNAVAILABLE",
      correlationId: requestId,
    },
  };
}

function postToUi(message: MainToUiMessage): void {
  figma.ui.postMessage(message);
}

function isUiMessage(value: unknown): value is UiToMainMessage {
  if (
    typeof value !== "object" ||
    value === null ||
    !("type" in value) ||
    typeof value.type !== "string"
  ) {
    return false;
  }

  switch (value.type) {
    case "ui_ready":
    case "clear_token":
    case "hide_ui":
    case "refresh_status":
      return true;
    case "store_token":
      return "token" in value && typeof value.token === "string";
    case "bridge_request":
      return "request" in value && typeof value.request === "object";
    case "reject_patch":
      return "patchId" in value && typeof value.patchId === "string";
    case "approve_patch":
      return (
        "patchId" in value &&
        typeof value.patchId === "string" &&
        "approvalDigest" in value &&
        typeof value.approvalDigest === "string" &&
        /^[a-f0-9]{64}$/.test(value.approvalDigest)
      );
    default:
      return false;
  }
}

function pluginError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}
