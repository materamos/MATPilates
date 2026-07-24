import { createServer, type IncomingMessage, type Server } from "node:http";
import { randomUUID } from "node:crypto";

import WebSocket, { WebSocketServer, type RawData } from "ws";

import {
  AUTH_TIMEOUT_MS,
  BRIDGE_HOST,
  BRIDGE_PATH,
  BRIDGE_PORT,
  BRIDGE_SUBPROTOCOL,
  BRIDGE_URL,
  HEARTBEAT_INTERVAL_MS,
  MAX_WS_PAYLOAD_BYTES,
  MAX_JSON_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  REQUEST_TIMEOUT_MS,
} from "../../shared/constants.js";
import {
  AuthMessageSchema,
  EventMessageSchema,
  parseJsonMessage,
  PluginResultSchemas,
  type PluginMethod,
  ResponseMessageSchema,
} from "../../shared/protocol.js";
import { BridgeError } from "./errors.js";
import { PairingStore } from "./pairing-store.js";

interface PendingRequest {
  socket: WebSocket;
  method: PluginMethod;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  signal?: AbortSignal;
  abortListener?: () => void;
}

type LiveSocket = WebSocket & { isAlive?: boolean };

const ALLOWED_ORIGINS = new Set([
  "null",
  "https://www.figma.com",
  "https://figma.com",
]);

function publicError(error: BridgeError) {
  return {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    ...(error.correlationId ? { correlationId: error.correlationId } : {}),
  };
}

function isLoopback(address: string | undefined): boolean {
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

export class PluginGateway {
  private readonly pairingStore: PairingStore;
  private httpServer: Server | null = null;
  private websocketServer: WebSocketServer | null = null;
  private pluginSocket: LiveSocket | null = null;
  private pluginInstallationId: string | null = null;
  private connectedAt: string | null = null;
  private heartbeat: NodeJS.Timeout | null = null;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private requestQueue: Promise<void> = Promise.resolve();

  constructor(pairingStore = new PairingStore()) {
    this.pairingStore = pairingStore;
  }

  async start(): Promise<void> {
    await this.pairingStore.initialize();
    if (this.httpServer) return;

    const websocketServer = new WebSocketServer({
      noServer: true,
      perMessageDeflate: false,
      maxPayload: MAX_WS_PAYLOAD_BYTES,
    });
    const httpServer = createServer((_request, response) => {
      response.writeHead(404).end();
    });

    httpServer.on("upgrade", (request, socket, head) => {
      if (!this.isAllowedUpgrade(request)) {
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }

      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        websocketServer.emit("connection", websocket, request);
      });
    });

    websocketServer.on("connection", (socket) => this.handleConnection(socket));

    await new Promise<void>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => {
        httpServer.off("listening", onListening);
        if (error.code === "EADDRINUSE") {
          reject(
            new BridgeError(
              "PLUGIN_BUSY",
              `Port ${BRIDGE_PORT} is already in use; the bridge will not select another port.`,
            ),
          );
          return;
        }
        reject(error);
      };
      const onListening = () => {
        httpServer.off("error", onError);
        resolve();
      };
      httpServer.once("error", onError);
      httpServer.once("listening", onListening);
      httpServer.listen(BRIDGE_PORT, BRIDGE_HOST);
    });

    this.httpServer = httpServer;
    this.websocketServer = websocketServer;
    this.heartbeat = setInterval(() => this.runHeartbeat(), HEARTBEAT_INTERVAL_MS);
    this.heartbeat.unref();
  }

  async close(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.rejectPending(
      new BridgeError("REQUEST_CANCELLED", "The bridge is shutting down."),
    );
    this.pluginSocket?.close(1001, "Bridge shutting down");
    this.pluginSocket = null;

    await Promise.all([
      new Promise<void>((resolve) => {
        if (!this.websocketServer) return resolve();
        this.websocketServer.close(() => resolve());
      }),
      new Promise<void>((resolve) => {
        if (!this.httpServer) return resolve();
        this.httpServer.close(() => resolve());
      }),
    ]);

    this.websocketServer = null;
    this.httpServer = null;
  }

  getPairingCode(): { code: string; expiresAt: string } {
    return this.pairingStore.getPairingCode();
  }

  async resetPairing(): Promise<void> {
    this.pluginSocket?.close(4002, "Pairing reset");
    await this.pairingStore.reset();
  }

  status() {
    return {
      protocolVersion: PROTOCOL_VERSION,
      endpoint: BRIDGE_URL,
      listening: this.httpServer?.listening ?? false,
      paired: this.pairingStore.isPaired,
      connected: this.pluginSocket?.readyState === WebSocket.OPEN,
      pluginInstallationId: this.pluginInstallationId,
      connectedAt: this.connectedAt,
    };
  }

  request(
    method: PluginMethod,
    payload: unknown,
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ): Promise<unknown> {
    const request = this.requestQueue.then(
      () => this.requestNow(method, payload, options),
      () => this.requestNow(method, payload, options),
    );
    this.requestQueue = request.then(
      () => undefined,
      () => undefined,
    );
    return request;
  }

  private async requestNow(
    method: PluginMethod,
    payload: unknown,
    options: { signal?: AbortSignal; timeoutMs?: number },
  ): Promise<unknown> {
    const socket = this.pluginSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new BridgeError(
        this.pairingStore.isPaired ? "PLUGIN_DISCONNECTED" : "PAIRING_REQUIRED",
        this.pairingStore.isPaired
          ? "Open the MAT — Codex Bridge plugin in Figma Desktop."
          : "Pair the Figma Desktop plugin before using this tool.",
        { retryable: true },
      );
    }

    if (options.signal?.aborted) {
      throw new BridgeError("REQUEST_CANCELLED", "The request was cancelled.");
    }

    const id = randomUUID();
    const message = JSON.stringify({
      v: PROTOCOL_VERSION,
      type: "request",
      id,
      method,
      payload,
    });
    if (Buffer.byteLength(message, "utf8") > MAX_JSON_MESSAGE_BYTES) {
      throw new BridgeError(
        "INVALID_PLUGIN_RESPONSE",
        "The request exceeds the local JSON message limit.",
      );
    }

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removePending(id);
        reject(
          new BridgeError(
            "REQUEST_TIMEOUT",
            `The Figma plugin did not answer ${method} in time.`,
            { retryable: true },
          ),
        );
      }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);

      const abortListener = options.signal
        ? () => {
            this.removePending(id);
            reject(
              new BridgeError("REQUEST_CANCELLED", "The request was cancelled."),
            );
          }
        : undefined;

      if (abortListener) {
        options.signal?.addEventListener("abort", abortListener, { once: true });
      }

      this.pendingRequests.set(id, {
        socket,
        method,
        resolve,
        reject,
        timer,
        signal: options.signal,
        abortListener,
      });

      socket.send(message, (error) => {
        if (!error) return;
        this.removePending(id);
        reject(
          new BridgeError(
            "PLUGIN_DISCONNECTED",
            "The request could not be sent to Figma.",
            { retryable: true, cause: error },
          ),
        );
      });
    });
  }

  private isAllowedUpgrade(request: IncomingMessage): boolean {
    const url = new URL(request.url ?? "/", `http://${BRIDGE_HOST}`);
    const origin = request.headers.origin;
    const protocols = (request.headers["sec-websocket-protocol"] ?? "")
      .split(",")
      .map((value) => value.trim());

    return (
      isLoopback(request.socket.remoteAddress) &&
      url.pathname === BRIDGE_PATH &&
      protocols.length === 1 &&
      protocols[0] === BRIDGE_SUBPROTOCOL &&
      (!origin || ALLOWED_ORIGINS.has(origin))
    );
  }

  private handleConnection(socket: LiveSocket): void {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    const authTimer = setTimeout(() => {
      socket.close(4003, "Authentication timeout");
    }, AUTH_TIMEOUT_MS);

    const authenticate = async (rawData: RawData, isBinary: boolean) => {
      if (isBinary) {
        socket.close(1003, "Text messages only");
        return;
      }

      try {
        const message = AuthMessageSchema.parse(
          parseJsonMessage(rawData.toString("utf8")),
        );
        let issuedToken: string | undefined;
        if (message.mode === "pair") {
          const paired = await this.pairingStore.pair(
            message.code,
            message.pluginInstallationId,
          );
          issuedToken = paired.token;
        } else if (
          !this.pairingStore.verifyToken(
            message.token,
            message.pluginInstallationId,
          )
        ) {
          throw new BridgeError(
            "PAIRING_REQUIRED",
            "The saved bridge token is invalid. Pair the plugin again.",
            { retryable: true },
          );
        }

        clearTimeout(authTimer);
        socket.off("message", authenticate);
        this.activateSocket(socket, message.pluginInstallationId);
        socket.send(
          JSON.stringify({
            v: PROTOCOL_VERSION,
            type: "auth_result",
            ok: true,
            ...(issuedToken ? { token: issuedToken } : {}),
          }),
        );
        socket.on("message", (data, binary) =>
          this.handleAuthenticatedMessage(socket, data, binary),
        );
      } catch (error) {
        const bridgeError =
          error instanceof BridgeError
            ? error
            : new BridgeError(
                "PROTOCOL_MISMATCH",
                "The authentication message is invalid.",
              );
        socket.send(
          JSON.stringify({
            v: PROTOCOL_VERSION,
            type: "auth_result",
            ok: false,
            error: publicError(bridgeError),
          }),
          () => socket.close(4003, "Authentication failed"),
        );
      }
    };

    socket.on("message", authenticate);
    socket.on("close", () => {
      clearTimeout(authTimer);
      if (this.pluginSocket !== socket) return;
      this.pluginSocket = null;
      this.pluginInstallationId = null;
      this.connectedAt = null;
      this.rejectPending(
        new BridgeError(
          "PLUGIN_DISCONNECTED",
          "The Figma plugin disconnected during the request.",
          { retryable: true },
        ),
        socket,
      );
    });
    socket.on("error", () => {
      // The close handler owns state cleanup. Error details may contain payload data.
    });
  }

  private activateSocket(
    socket: LiveSocket,
    pluginInstallationId: string,
  ): void {
    if (this.pluginSocket && this.pluginSocket !== socket) {
      const replacedSocket = this.pluginSocket;
      this.rejectPending(
        new BridgeError(
          "PLUGIN_DISCONNECTED",
          "The Figma plugin connection was replaced during the request.",
          { retryable: true },
        ),
        replacedSocket,
      );
      replacedSocket.close(4001, "Replaced by a newer connection");
    }
    this.pluginSocket = socket;
    this.pluginInstallationId = pluginInstallationId;
    this.connectedAt = new Date().toISOString();
  }

  private handleAuthenticatedMessage(
    socket: LiveSocket,
    rawData: RawData,
    isBinary: boolean,
  ): void {
    if (socket !== this.pluginSocket || isBinary) {
      socket.close(1003, "Invalid message");
      return;
    }

    let parsed: unknown;
    const rawText = rawData.toString("utf8");
    try {
      parsed = parseJsonMessage(
        rawText,
        MAX_WS_PAYLOAD_BYTES,
      );
    } catch {
      socket.close(1007, "Invalid JSON");
      return;
    }

    const response = ResponseMessageSchema.safeParse(parsed);
    if (response.success) {
      const pending = this.pendingRequests.get(response.data.id);
      if (!pending || pending.socket !== socket) return;
      if (
        pending.method !== "export_preview" &&
        Buffer.byteLength(rawText, "utf8") > MAX_JSON_MESSAGE_BYTES
      ) {
        this.removePending(response.data.id);
        pending.reject(
          new BridgeError(
            "INVALID_PLUGIN_RESPONSE",
            "The Figma plugin response exceeds the JSON message limit.",
          ),
        );
        return;
      }
      this.removePending(response.data.id);
      if (response.data.ok) {
        const result = PluginResultSchemas[pending.method].safeParse(
          response.data.result,
        );
        if (!result.success) {
          pending.reject(
            new BridgeError(
              "INVALID_PLUGIN_RESPONSE",
              `The Figma plugin returned an invalid ${pending.method} result.`,
            ),
          );
          return;
        }
        pending.resolve(result.data);
      } else {
        const error = response.data.error;
        pending.reject(
          new BridgeError(
            error?.code ?? "INVALID_PLUGIN_RESPONSE",
            error?.message ?? "The Figma plugin returned an invalid error.",
            { retryable: error?.retryable ?? false },
          ),
        );
      }
      return;
    }

    const event = EventMessageSchema.safeParse(parsed);
    if (event.success) return;
    socket.close(1007, "Protocol validation failed");
  }

  private runHeartbeat(): void {
    const socket = this.pluginSocket;
    if (!socket) return;
    if (socket.isAlive === false) {
      socket.terminate();
      return;
    }
    socket.isAlive = false;
    socket.ping();
  }

  private removePending(id: string): PendingRequest | undefined {
    const pending = this.pendingRequests.get(id);
    if (!pending) return undefined;
    clearTimeout(pending.timer);
    if (pending.abortListener) {
      pending.signal?.removeEventListener("abort", pending.abortListener);
    }
    this.pendingRequests.delete(id);
    return pending;
  }

  private rejectPending(error: Error, socket?: WebSocket): void {
    for (const [id, pending] of this.pendingRequests) {
      if (socket && pending.socket !== socket) continue;
      this.removePending(id);
      pending.reject(error);
    }
  }
}
