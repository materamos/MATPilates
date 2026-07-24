import {
  EventMessageSchema,
  PatchProposalSchema,
  RequestMessageSchema,
  ResponseMessageSchema,
  ToolInputs,
  type FontRole,
  type PatchOperation,
  type PatchProposal,
  type PatchStatus,
  type PublicErrorCode,
  type RequestMessage,
  type ResponseMessage,
  type TypographyProperties,
} from "../../shared/protocol.js";

export {
  AuthMessageSchema,
  AuthResultMessageSchema,
  EventMessageSchema,
  FontRoleSchema as fontRoleSchema,
  PatchProposalSchema as typographyPatchSchema,
  parseJsonMessage,
  RequestMessageSchema as bridgeRequestSchema,
  ResponseMessageSchema as bridgeResponseSchema,
  ToolInputs,
  type AuthMessage,
  type AuthResultMessage,
  type EventMessage as BridgeEvent,
  type FontRole,
  type PatchOperation,
  type PatchProposal as TypographyPatch,
  type PublicErrorCode,
  type RequestMessage as BridgeRequest,
  type ResponseMessage as BridgeResponse,
  type TypographyProperties,
} from "../../shared/protocol.js";

export {
  BRIDGE_SUBPROTOCOL,
  BRIDGE_URL,
  HEARTBEAT_INTERVAL_MS,
  MAX_AUDIT_TEXT_NODES,
  MAX_PATCH_NODES,
  MAX_PATCH_OPERATIONS,
  MAX_PREVIEW_BYTES,
  MAX_PREVIEW_DIMENSION,
  MAX_WS_PAYLOAD_BYTES,
  PATCH_TTL_MS,
  PROTOCOL_VERSION,
  REQUEST_TIMEOUT_MS,
} from "../../shared/constants.js";

export type SerializableLineHeight = NonNullable<
  TypographyProperties["lineHeight"]
>;
export type SerializableLetterSpacing = NonNullable<
  TypographyProperties["letterSpacing"]
>;

export const auditInputSchema = ToolInputs.auditTypography;
export type AuditInput = ReturnType<typeof auditInputSchema.parse>;

export const getNodeInputSchema = ToolInputs.getNode;
export type GetNodeInput = ReturnType<typeof getNodeInputSchema.parse>;

export const exportPreviewInputSchema = ToolInputs.exportPreview;
export type ExportPreviewInput = ReturnType<
  typeof exportPreviewInputSchema.parse
>;

export const serverEnvelopeSchema = RequestMessageSchema.or(
  ResponseMessageSchema,
).or(EventMessageSchema);

export type LocalPatchStatus = PatchStatus;

export interface BridgeTechnicalError {
  code: string;
  message: string;
  details?: unknown;
}

export interface UiPatchSummary {
  patchId: string;
  title: string;
  detail: string;
  operationCount: number;
  styleChanges: number;
  nodeChanges: number;
  globalStyleUpdates: number;
  impactedNodes: number;
  expiresAt: number;
  warnings: string[];
  operationDetails: string[];
}

export interface PatchStatusSnapshot {
  patchId: string;
  approvalDigest: string;
  status: LocalPatchStatus;
  updatedAt: number;
  summary: UiPatchSummary;
  result?: {
    operationCount: number;
    affectedNodeIds: string[];
    dimensionChanges: Array<{
      nodeId: string;
      before: { width: number; height: number };
      after: { width: number; height: number };
    }>;
    createdStyleIds: string[];
    createdNodeIds: string[];
    warnings: string[];
  };
  error?: BridgeTechnicalError;
}

export interface PreviewResult {
  data: string;
  mimeType: "image/png";
  width: number;
  height: number;
  byteLength: number;
  nodeId: string;
  fingerprint: string;
}

export type MainToUiMessage =
  | {
      type: "bootstrap";
      token: string | null;
      pluginInstallationId: string;
      status: unknown;
      pendingPatch: PatchStatusSnapshot | null;
    }
  | { type: "bridge_response"; response: ResponseMessage }
  | { type: "plugin_status"; status: unknown }
  | { type: "patch_status"; patch: PatchStatusSnapshot }
  | { type: "token_stored" }
  | { type: "token_cleared" }
  | { type: "ui_error"; error: BridgeTechnicalError };

export type UiToMainMessage =
  | { type: "ui_ready" }
  | { type: "bridge_request"; request: RequestMessage }
  | { type: "store_token"; token: string }
  | { type: "clear_token" }
  | { type: "reject_patch"; patchId: string }
  | { type: "approve_patch"; patchId: string; approvalDigest: string }
  | { type: "hide_ui" }
  | { type: "refresh_status" };

export function publicErrorCodeForInternalCode(
  code: string,
): PublicErrorCode {
  switch (code) {
    case "PATCH_EXPIRED":
      return "PATCH_EXPIRED";
    case "PATCH_ALREADY_PENDING":
      return "PLUGIN_BUSY";
    case "PATCH_NOT_PENDING":
    case "PATCH_STATUS_NOT_FOUND":
      return "PATCH_NOT_FOUND";
    case "STALE_FINGERPRINT":
    case "FILE_MISMATCH":
    case "PAGE_MISMATCH":
    case "SELECTION_CHANGED":
      return "PATCH_STALE";
    case "FONT_UNAVAILABLE":
      return "FONT_UNAVAILABLE";
    case "FONT_WEIGHT_REJECTED":
    case "FONT_NOT_ALLOWED":
    case "UNSUPPORTED_FONT_STYLE":
      return "UNSUPPORTED_FONT_STYLE";
    case "ROLLBACK_NOT_CONFIRMED":
      return "ROLLBACK_FAILED";
    case "INVALID_PATCH":
    case "INVALID_PLUGIN_REQUEST":
      return "INVALID_PLUGIN_RESPONSE";
    default:
      return "FIGMA_OPERATION_FAILED";
  }
}

// Keep these aliases local so plugin implementation code stays readable while
// the canonical wire contract remains in shared/protocol.ts.
export type PluginPatchOperation = PatchOperation;
export type PluginTypographyPatch = PatchProposal;
export type PluginFontRole = FontRole;
