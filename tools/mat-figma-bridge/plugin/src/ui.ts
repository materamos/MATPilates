import {
  AuthResultMessageSchema,
  BRIDGE_SUBPROTOCOL,
  BRIDGE_URL,
  EventMessageSchema,
  HEARTBEAT_INTERVAL_MS,
  PROTOCOL_VERSION,
  bridgeRequestSchema,
  parseJsonMessage,
  serverEnvelopeSchema,
  type AuthMessage,
  type BridgeEvent,
  type BridgeResponse,
  type MainToUiMessage,
  type PatchStatusSnapshot,
  type UiToMainMessage,
} from "./contracts";

type ConnectionState =
  | "starting"
  | "server_offline"
  | "pairing_required"
  | "authenticating"
  | "connected";

interface UiState {
  connection: ConnectionState;
  token: string | null;
  pluginInstallationId: string | null;
  pluginStatus: PluginStatusView | null;
  pendingPatch: PatchStatusSnapshot | null;
  latestPatch: PatchStatusSnapshot | null;
  error: string | null;
}

interface PluginStatusView {
  file?: {
    key?: string | null;
    name?: string;
    page?: { id?: string; name?: string };
  };
  selection?: {
    count?: number;
    textCount?: number;
  };
  fonts?: Array<{
    role?: string;
    family?: string;
    style?: string;
    available?: boolean;
  }>;
  pendingPatch?: PatchStatusSnapshot | null;
  latestPatch?: PatchStatusSnapshot | null;
}

const state: UiState = {
  connection: "starting",
  token: null,
  pluginInstallationId: null,
  pluginStatus: null,
  pendingPatch: null,
  latestPatch: null,
  error: null,
};

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
let intentionallyClosed = false;
let pendingPairingCode: string | null = null;

const elements = {
  connectionDot: requiredElement("connection-dot"),
  connectionLabel: requiredElement("connection-label"),
  fileLabel: requiredElement("file-label"),
  pageLabel: requiredElement("page-label"),
  hideButton: requiredButton("hide-button"),
  pairingPanel: requiredElement("pairing-panel"),
  pairingForm: requiredForm("pairing-form"),
  pairingCode: requiredInput("pairing-code"),
  pairingButton: requiredButton("pairing-button"),
  fontRegular: requiredElement("font-regular"),
  fontMedium: requiredElement("font-medium"),
  fontBold: requiredElement("font-bold"),
  selectionLabel: requiredElement("selection-label"),
  pendingEmpty: requiredElement("pending-empty"),
  pendingCard: requiredElement("pending-card"),
  pendingTitle: requiredElement("pending-title"),
  pendingDetail: requiredElement("pending-detail"),
  pendingOperations: requiredElement("pending-operations"),
  pendingCounts: requiredElement("pending-counts"),
  pendingImpact: requiredElement("pending-impact"),
  pendingWarnings: requiredElement("pending-warnings"),
  pendingExpiry: requiredElement("pending-expiry"),
  rejectButton: requiredButton("reject-button"),
  applyButton: requiredButton("apply-button"),
  latestEmpty: requiredElement("latest-empty"),
  latestCard: requiredElement("latest-card"),
  latestStatus: requiredElement("latest-status"),
  latestDetail: requiredElement("latest-detail"),
  forgetButton: requiredButton("forget-button"),
  errorBanner: requiredElement("error-banner"),
  errorText: requiredElement("error-text"),
  dismissError: requiredButton("dismiss-error"),
};

window.addEventListener("message", (event: MessageEvent<{ pluginMessage?: unknown }>) => {
  if (event.source !== parent) {
    return;
  }
  const message = event.data?.pluginMessage;
  if (isMainToUiMessage(message)) {
    handleMainMessage(message);
  }
});

elements.pairingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = elements.pairingCode.value.replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) {
    setError("Ingresá el código de seis dígitos generado por Codex.");
    return;
  }
  pendingPairingCode = code;
  connect();
});

elements.pairingCode.addEventListener("input", () => {
  elements.pairingCode.value = elements.pairingCode.value
    .replace(/\D/g, "")
    .slice(0, 6);
  render();
});

elements.hideButton.addEventListener("click", () => {
  postToMain({ type: "hide_ui" });
});

elements.forgetButton.addEventListener("click", () => {
  state.token = null;
  postToMain({ type: "clear_token" });
  intentionallyClosed = true;
  if (socket !== null) {
    socket.close(4004, "Local pairing forgotten");
  }
  setTimeout(() => {
    intentionallyClosed = false;
    connect();
  }, 150);
  render();
});

elements.rejectButton.addEventListener("click", () => {
  if (state.pendingPatch !== null) {
    postToMain({
      type: "reject_patch",
      patchId: state.pendingPatch.patchId,
    });
  }
});

elements.applyButton.addEventListener("click", () => {
  if (state.pendingPatch !== null) {
    elements.applyButton.disabled = true;
    elements.rejectButton.disabled = true;
    postToMain({
      type: "approve_patch",
      patchId: state.pendingPatch.patchId,
      approvalDigest: state.pendingPatch.approvalDigest,
    });
  }
});

elements.dismissError.addEventListener("click", () => {
  state.error = null;
  render();
});

postToMain({ type: "ui_ready" });
render();

function handleMainMessage(message: MainToUiMessage): void {
  switch (message.type) {
    case "bootstrap":
      state.token = message.token;
      state.pluginInstallationId = message.pluginInstallationId;
      state.pluginStatus = asPluginStatus(message.status);
      state.pendingPatch = message.pendingPatch;
      state.latestPatch = state.pluginStatus?.latestPatch ?? null;
      connect();
      break;

    case "bridge_response":
      sendSocketMessage(message.response);
      break;

    case "plugin_status":
      state.pluginStatus = asPluginStatus(message.status);
      if (state.pluginStatus?.pendingPatch !== undefined) {
        state.pendingPatch = state.pluginStatus.pendingPatch ?? null;
      }
      if (state.pluginStatus?.latestPatch !== undefined) {
        state.latestPatch = state.pluginStatus.latestPatch ?? null;
      }
      publishPluginState();
      break;

    case "patch_status":
      state.latestPatch = message.patch;
      state.pendingPatch =
        message.patch.status === "pending_approval" ||
        message.patch.status === "applying"
          ? message.patch
          : null;
      sendPatchStatus(message.patch);
      break;

    case "token_stored":
      break;

    case "token_cleared":
      state.token = null;
      state.connection = "pairing_required";
      break;

    case "ui_error":
      setError(message.error.message);
      break;
  }
  render();
}

function connect(): void {
  if (state.pluginInstallationId === null) {
    return;
  }

  clearReconnectTimer();
  stopConnectionTimers();
  const previousSocket = socket;
  if (previousSocket !== null) {
    previousSocket.close(1000, "Reconnecting");
  }

  intentionallyClosed = false;
  state.connection = "starting";
  render();

  try {
    socket = new WebSocket(BRIDGE_URL, BRIDGE_SUBPROTOCOL);
  } catch {
    setOfflineAndRetry();
    return;
  }
  const activeSocket = socket;

  activeSocket.addEventListener("open", () => {
    if (socket !== activeSocket) {
      activeSocket.close(1000, "Superseded");
      return;
    }
    if (activeSocket.protocol !== BRIDGE_SUBPROTOCOL) {
      setError("El servidor local respondió con un protocolo incompatible.");
      activeSocket.close(1002, "Protocol mismatch");
      return;
    }
    reconnectAttempts = 0;
    state.connection = state.token === null
      ? "pairing_required"
      : "authenticating";
    render();

    if (state.token !== null) {
      authenticate({ mode: "token", token: state.token });
    } else if (pendingPairingCode !== null) {
      authenticate({ mode: "pair", code: pendingPairingCode });
    } else {
      intentionallyClosed = true;
      activeSocket.close(1000, "Pairing input required");
    }
  });

  activeSocket.addEventListener("message", (event) => {
    if (socket !== activeSocket) {
      return;
    }
    if (typeof event.data !== "string") {
      setError("El servidor local envió un mensaje binario no admitido.");
      return;
    }
    handleServerMessage(event.data);
  });

  activeSocket.addEventListener("close", () => {
    if (socket !== activeSocket) {
      return;
    }
    socket = null;
    stopConnectionTimers();
    if (!intentionallyClosed) {
      setOfflineAndRetry();
    }
  });

  activeSocket.addEventListener("error", () => {
    if (socket !== activeSocket) {
      return;
    }
    if (state.connection !== "server_offline") {
      state.connection = "server_offline";
      render();
    }
  });
}

function handleServerMessage(rawMessage: string): void {
  let value: unknown;
  try {
    value = parseJsonMessage(rawMessage);
  } catch {
    setError("El servidor local envió un mensaje JSON no válido.");
    return;
  }

  const authResult = AuthResultMessageSchema.safeParse(value);
  if (authResult.success) {
    handleAuthResult(authResult.data);
    return;
  }

  const envelope = serverEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    setError("El servidor local envió un mensaje fuera del protocolo.");
    return;
  }

  const message = envelope.data;
  if (message.type === "request") {
    const request = bridgeRequestSchema.safeParse(message);
    if (!request.success) {
      return;
    }
    postToMain({ type: "bridge_request", request: request.data });
    return;
  }

  if (message.type === "event" && message.event === "heartbeat") {
    sendHeartbeat();
  }
}

function authenticate(
  credentials:
    | { mode: "pair"; code: string }
    | { mode: "token"; token: string },
): void {
  if (
    socket?.readyState !== WebSocket.OPEN ||
    state.pluginInstallationId === null
  ) {
    setError("El servidor local todavía no está disponible.");
    return;
  }

  state.connection = "authenticating";
  render();

  const message: AuthMessage =
    credentials.mode === "pair"
      ? {
          v: PROTOCOL_VERSION,
          type: "auth",
          mode: "pair",
          code: credentials.code,
          pluginInstallationId: state.pluginInstallationId,
        }
      : {
          v: PROTOCOL_VERSION,
          type: "auth",
          mode: "token",
          token: credentials.token,
          pluginInstallationId: state.pluginInstallationId,
        };
  sendSocketMessage(message);
}

function handleAuthResult(
  result: ReturnType<typeof AuthResultMessageSchema.parse>,
): void {
  if (!result.ok) {
    pendingPairingCode = null;
    intentionallyClosed = true;
    const wasTokenAuth = state.token !== null;
    if (
      wasTokenAuth &&
      (result.error?.code === "PAIRING_REQUIRED" ||
        result.error?.code === "PROTOCOL_MISMATCH")
    ) {
      state.token = null;
      postToMain({ type: "clear_token" });
    }
    state.connection = "pairing_required";
    setError(authErrorMessage(result.error?.code, result.error?.message));
    return;
  }

  if (result.token !== undefined && result.token !== state.token) {
    state.token = result.token;
    postToMain({ type: "store_token", token: result.token });
  }

  state.connection = "connected";
  pendingPairingCode = null;
  state.error = null;
  elements.pairingCode.value = "";
  startConnectionTimers();
  publishPluginState();
  render();
}

function publishPluginState(): void {
  if (state.connection !== "connected") {
    return;
  }
  const event: BridgeEvent = EventMessageSchema.parse({
    v: PROTOCOL_VERSION,
    type: "event",
    event: "plugin_state",
    payload: {
      status: state.pluginStatus,
      at: new Date().toISOString(),
    },
  });
  sendSocketMessage(event);
}

function sendPatchStatus(patch: PatchStatusSnapshot): void {
  if (state.connection !== "connected") {
    return;
  }
  const event: BridgeEvent = EventMessageSchema.parse({
    v: PROTOCOL_VERSION,
    type: "event",
    event: "patch_status",
    payload: patch,
  });
  sendSocketMessage(event);
}

function sendHeartbeat(): void {
  if (state.connection !== "connected") {
    return;
  }
  const event: BridgeEvent = EventMessageSchema.parse({
    v: PROTOCOL_VERSION,
    type: "event",
    event: "heartbeat",
    payload: { at: new Date().toISOString() },
  });
  sendSocketMessage(event);
}

function startConnectionTimers(): void {
  stopConnectionTimers();
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
}

function stopConnectionTimers(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function setOfflineAndRetry(): void {
  state.connection = "server_offline";
  render();
  const delay = Math.min(10_000, 1_000 * 2 ** reconnectAttempts);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(connect, delay + Math.floor(Math.random() * 250));
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function sendSocketMessage(
  message: AuthMessage | BridgeResponse | BridgeEvent,
): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function postToMain(message: UiToMainMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

function render(): void {
  const connectionPresentation = connectionView(state.connection);
  elements.connectionDot.dataset.state = state.connection;
  elements.connectionLabel.textContent = connectionPresentation.label;
  elements.connectionLabel.title = connectionPresentation.detail;

  const file = state.pluginStatus?.file;
  elements.fileLabel.textContent = file?.name ?? "Archivo sin identificar";
  elements.pageLabel.textContent = file?.page?.name ?? "Página sin identificar";

  renderFontChip("regular", elements.fontRegular);
  renderFontChip("medium", elements.fontMedium);
  renderFontChip("bold", elements.fontBold);

  const selection = state.pluginStatus?.selection;
  elements.selectionLabel.textContent =
    selection?.count === undefined
      ? "Sin datos de selección"
      : `${selection.count} seleccionados · ${selection.textCount ?? 0} textos`;

  renderPendingPatch();
  renderLatestPatch();

  elements.pairingPanel.hidden = state.connection !== "pairing_required";
  elements.forgetButton.disabled = state.token === null;
  elements.pairingButton.disabled =
    state.connection === "authenticating" ||
    elements.pairingCode.value.length !== 6;

  elements.errorBanner.hidden = state.error === null;
  elements.errorText.textContent = state.error ?? "";
}

function renderFontChip(
  role: "regular" | "medium" | "bold",
  element: HTMLElement,
): void {
  const font = state.pluginStatus?.fonts?.find((item) => item.role === role);
  const available = font?.available === true;
  element.dataset.available = available ? "true" : "false";
  element.querySelector("[data-icon]")!.textContent = available ? "✓" : "!";
  element.title = available
    ? `${font?.family} / ${font?.style} disponible`
    : `Neue Montreal / ${capitalize(role)} no disponible`;
}

function renderPendingPatch(): void {
  const patch = state.pendingPatch;
  const hasPending =
    patch !== null &&
    (patch.status === "pending_approval" || patch.status === "applying");
  elements.pendingEmpty.hidden = hasPending;
  elements.pendingCard.hidden = !hasPending;
  if (!hasPending || patch === null) {
    return;
  }

  elements.pendingTitle.textContent = patch.summary.title;
  elements.pendingDetail.textContent = patch.summary.detail;
  elements.pendingOperations.replaceChildren(
    ...patch.summary.operationDetails.map((detail) => {
      const item = document.createElement("li");
      item.textContent = detail;
      return item;
    }),
  );
  elements.pendingCounts.textContent =
    `${formatCount(patch.summary.styleChanges, "estilo", "estilos")} · ` +
    formatCount(
      patch.summary.nodeChanges,
      "operación sobre capa",
      "operaciones sobre capas",
    );
  elements.pendingImpact.textContent =
    `Impacto: ${formatCount(patch.summary.impactedNodes, "capa", "capas")} · ` +
    `${formatCount(
      patch.summary.globalStyleUpdates,
      "estilo global",
      "estilos globales",
    )} · 0 pesos desconocidos`;
  elements.pendingWarnings.textContent = patch.summary.warnings.join(" ");
  elements.pendingWarnings.hidden = patch.summary.warnings.length === 0;
  elements.pendingExpiry.textContent =
    patch.status === "applying"
      ? "Aplicando y validando…"
      : `Vence ${relativeExpiry(patch.summary.expiresAt)}`;
  elements.rejectButton.disabled = patch.status === "applying";
  elements.applyButton.disabled = patch.status === "applying";
  elements.applyButton.textContent =
    patch.status === "applying" ? "Aplicando…" : "Aplicar";
}

function renderLatestPatch(): void {
  const patch = state.latestPatch;
  const hasLatest =
    patch !== null &&
    patch.status !== "pending_approval" &&
    patch.status !== "applying";
  elements.latestEmpty.hidden = hasLatest;
  elements.latestCard.hidden = !hasLatest;
  if (!hasLatest || patch === null) {
    return;
  }

  elements.latestStatus.textContent = patchStatusLabel(patch.status);
  elements.latestStatus.dataset.status = patch.status;
  if (patch.result !== undefined) {
    elements.latestDetail.textContent =
      `${patch.result.operationCount} operaciones · ` +
      `${patch.result.dimensionChanges.length} cambios de dimensión`;
  } else if (patch.error !== undefined) {
    elements.latestDetail.textContent = patch.error.message;
  } else {
    elements.latestDetail.textContent = `${patch.summary.operationCount} operaciones`;
  }

}

function connectionView(connection: ConnectionState): {
  label: string;
  detail: string;
} {
  switch (connection) {
    case "starting":
      return { label: "Conectando", detail: "Abriendo el puente local." };
    case "server_offline":
      return {
        label: "Servidor desconectado",
        detail: "Iniciá MAT Figma Local Bridge desde Codex.",
      };
    case "pairing_required":
      return {
        label: "Requiere emparejamiento",
        detail: "Ingresá el código temporal generado por Codex.",
      };
    case "authenticating":
      return {
        label: "Autenticando",
        detail: "Validando este plugin con el servidor local.",
      };
    case "connected":
      return { label: "Conectado", detail: "Puente local disponible." };
  }
}

function patchStatusLabel(status: PatchStatusSnapshot["status"]): string {
  switch (status) {
    case "applied":
      return "Aplicado";
    case "rejected":
      return "Rechazado sin cambios";
    case "cancelled":
      return "Cancelado sin cambios";
    case "expired":
      return "Vencido sin cambios";
    case "stale":
      return "Obsoleto por cambios concurrentes";
    case "failed_rolled_back":
      return "Fallo revertido";
    case "failed_rollback":
      return "Reversión no confirmada";
    case "indeterminate":
      return "Estado indeterminado";
    case "pending_approval":
      return "Pendiente";
    case "applying":
      return "Aplicando";
  }
}

function authErrorMessage(code?: string, fallback?: string): string {
  switch (code) {
    case "PAIRING_REQUIRED":
      return "El código venció, es incorrecto o el vínculo guardado ya no es válido.";
    case "PAIRING_RATE_LIMITED":
      return "Hubo demasiados intentos. Esperá unos segundos y generá un código nuevo.";
    case "PROTOCOL_MISMATCH":
      return "El plugin y el servidor usan versiones incompatibles.";
    default:
      return fallback ?? "No se pudo autenticar con el servidor local.";
  }
}

function relativeExpiry(expiresAt: number): string {
  const remainingSeconds = Math.max(
    0,
    Math.ceil((expiresAt - Date.now()) / 1_000),
  );
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `en ${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function setError(message: string): void {
  state.error = message;
  render();
}

function asPluginStatus(value: unknown): PluginStatusView | null {
  return typeof value === "object" && value !== null
    ? (value as PluginStatusView)
    : null;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCount(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function isMainToUiMessage(value: unknown): value is MainToUiMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string"
  );
}

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Missing UI element: ${id}`);
  }
  return element;
}

function requiredButton(id: string): HTMLButtonElement {
  const element = requiredElement(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`UI element is not a button: ${id}`);
  }
  return element;
}

function requiredInput(id: string): HTMLInputElement {
  const element = requiredElement(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`UI element is not an input: ${id}`);
  }
  return element;
}

function requiredForm(id: string): HTMLFormElement {
  const element = requiredElement(id);
  if (!(element instanceof HTMLFormElement)) {
    throw new Error(`UI element is not a form: ${id}`);
  }
  return element;
}
