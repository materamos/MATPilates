export const PROTOCOL_VERSION = 1 as const;
export const BRIDGE_HOST = "127.0.0.1";
export const BRIDGE_HOSTS = [BRIDGE_HOST, "::1"] as const;
export const BRIDGE_CLIENT_HOST = "localhost";
export const BRIDGE_PORT = 3847;
export const BRIDGE_PATH = "/mat-figma-bridge";
export const BRIDGE_SUBPROTOCOL = "mat-figma-bridge.v1";
export const BRIDGE_URL =
  `ws://${BRIDGE_CLIENT_HOST}:${BRIDGE_PORT}${BRIDGE_PATH}`;

export const PAIRING_CODE_TTL_MS = 5 * 60 * 1_000;
export const PAIRING_LOCK_MS = 30 * 1_000;
export const MAX_PAIRING_ATTEMPTS = 5;
export const AUTH_TIMEOUT_MS = 5_000;
export const HEARTBEAT_INTERVAL_MS = 20_000;
export const REQUEST_TIMEOUT_MS = 30_000;
export const PATCH_TTL_MS = 5 * 60 * 1_000;

export const MAX_PATCH_OPERATIONS = 100;
export const MAX_PATCH_NODES = 500;
export const MAX_PATCH_CHARACTERS = 100_000;
export const MAX_AUDIT_TEXT_NODES = 1_000;
export const MAX_JSON_MESSAGE_BYTES = 512 * 1_024;
export const MAX_WS_PAYLOAD_BYTES = 8 * 1_024 * 1_024;
export const MAX_PREVIEW_BYTES = 4 * 1_024 * 1_024;
export const MAX_PREVIEW_DIMENSION = 1_280;

export const FONT_FAMILY = "Neue Montreal";
export const FONT_STYLES = {
  regular: "Regular",
  medium: "Medium",
  bold: "Bold",
} as const;

export const CREDENTIALS_DIRECTORY = ["MAT Pilates", "Figma Bridge"] as const;
export const CREDENTIALS_FILE = "credentials.json";
