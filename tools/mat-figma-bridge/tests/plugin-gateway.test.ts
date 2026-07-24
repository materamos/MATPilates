import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import WebSocket, { type RawData } from "ws";

import {
  BRIDGE_PATH,
  BRIDGE_PORT,
  BRIDGE_SUBPROTOCOL,
  BRIDGE_URL,
  PROTOCOL_VERSION,
} from "../shared/constants.js";
import { PairingStore } from "../server/src/pairing-store.js";
import { PluginGateway } from "../server/src/plugin-gateway.js";

interface JsonRecord {
  [key: string]: unknown;
}

let activeBridgeUrl = BRIDGE_URL;

function selectionResult() {
  return {
    fileKey: "test-file-key",
    page: { id: "0:1", name: "Foundations" },
    selectedNodeIds: ["375:12"],
    nodes: [
      {
        id: "375:12",
        parentId: "0:1",
        type: "FRAME",
        name: "Typography",
        visible: true,
        locked: false,
        width: 1_200,
        height: 800,
      },
    ],
    textNodes: [],
    textNodeCount: 0,
    detailsTruncated: false,
    selectionDetailsTruncated: false,
  };
}

function nextJson(socket: WebSocket): Promise<JsonRecord> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: RawData, isBinary: boolean) => {
      cleanup();
      if (isBinary) {
        reject(new Error("Expected a text WebSocket message."));
        return;
      }

      try {
        resolve(JSON.parse(data.toString("utf8")) as JsonRecord);
      } catch (error) {
        reject(error);
      }
    };
    const onClose = (code: number, reason: Buffer) => {
      cleanup();
      reject(
        new Error(
          `Socket closed before a message arrived (${code}: ${reason.toString("utf8")}).`,
        ),
      );
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("message", onMessage);
      socket.off("close", onClose);
      socket.off("error", onError);
    };

    socket.once("message", onMessage);
    socket.once("close", onClose);
    socket.once("error", onError);
  });
}

function openClient(
  options: {
    url?: string;
    protocol?: string | string[];
    origin?: string;
  } = {},
): Promise<WebSocket> {
  const protocols = options.protocol ?? BRIDGE_SUBPROTOCOL;
  const client = new WebSocket(options.url ?? activeBridgeUrl, protocols, {
    ...(options.origin ? { origin: options.origin } : {}),
  });

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      client.off("open", onOpen);
      client.off("error", onError);
    };
    const onOpen = () => {
      cleanup();
      resolve(client);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    client.once("open", onOpen);
    client.once("error", onError);
  });
}

function rejectedUpgrade(
  options: {
    url?: string;
    protocol?: string | string[];
    origin?: string;
  } = {},
): Promise<number> {
  const client = new WebSocket(
    options.url ?? activeBridgeUrl,
    options.protocol ?? BRIDGE_SUBPROTOCOL,
    {
      ...(options.origin ? { origin: options.origin } : {}),
    },
  );

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      client.terminate();
      reject(new Error("Timed out waiting for the rejected upgrade."));
    }, 2_000);
    timer.unref();

    const cleanup = () => {
      clearTimeout(timer);
      client.off("open", onOpen);
      client.off("unexpected-response", onUnexpectedResponse);
      client.off("error", onError);
    };
    const onOpen = () => {
      cleanup();
      client.close();
      reject(new Error("The WebSocket upgrade was unexpectedly accepted."));
    };
    const onUnexpectedResponse = (
      _request: unknown,
      response: NodeJS.ReadableStream & { statusCode?: number; destroy(): void },
    ) => {
      const statusCode = response.statusCode ?? 0;
      cleanup();
      response.destroy();
      resolve(statusCode);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    client.once("open", onOpen);
    client.once("unexpected-response", onUnexpectedResponse);
    client.once("error", onError);
  });
}

async function closeClient(client: WebSocket): Promise<void> {
  if (client.readyState === WebSocket.CLOSED) return;
  if (client.readyState === WebSocket.CONNECTING) {
    client.terminate();
    return;
  }

  const closed = new Promise<void>((resolve) => {
    client.once("close", () => resolve());
  });
  client.close(1000, "Test complete");
  await closed;
}

async function pairClient(
  gateway: PluginGateway,
  pluginInstallationId: string,
  origin?: string,
): Promise<{ client: WebSocket; token: string }> {
  const pairing = gateway.getPairingCode();
  const client = await openClient({ origin });
  const response = nextJson(client);
  client.send(
    JSON.stringify({
      v: PROTOCOL_VERSION,
      type: "auth",
      mode: "pair",
      code: pairing.code,
      pluginInstallationId,
    }),
  );
  const authResult = await response;

  expect(authResult).toMatchObject({
    v: PROTOCOL_VERSION,
    type: "auth_result",
    ok: true,
    token: expect.any(String),
  });

  return { client, token: authResult.token as string };
}

describe.sequential("PluginGateway WebSocket boundary", () => {
  let temporaryDirectory: string;
  let gateway: PluginGateway;
  let clients: WebSocket[];

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), "mat-figma-plugin-gateway-"),
    );
    gateway = new PluginGateway(
      new PairingStore(join(temporaryDirectory, "credentials.json")),
      { port: 0 },
    );
    clients = [];
    await gateway.start();
    activeBridgeUrl = gateway.status().endpoint;
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => closeClient(client)));
    await gateway.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("binds the fixed loopback endpoint and enforces path, subprotocol, and origin", async () => {
    const testPort = Number(new URL(activeBridgeUrl).port);
    expect(gateway.status()).toMatchObject({
      endpoint: activeBridgeUrl,
      listening: true,
      connected: false,
    });

    const ipv4Client = await openClient({
      url: `ws://127.0.0.1:${testPort}${BRIDGE_PATH}`,
      origin: "https://www.figma.com",
    });
    const ipv6Client = await openClient({
      url: `ws://[::1]:${testPort}${BRIDGE_PATH}`,
      origin: "https://www.figma.com",
    });
    clients.push(ipv4Client, ipv6Client);
    expect(ipv4Client.protocol).toBe(BRIDGE_SUBPROTOCOL);
    expect(ipv6Client.protocol).toBe(BRIDGE_SUBPROTOCOL);

    await expect(
      rejectedUpgrade({
        url: `ws://127.0.0.1:${testPort}/another-path`,
      }),
    ).resolves.toBe(403);
    await expect(
      rejectedUpgrade({ protocol: [] }),
    ).resolves.toBe(403);
    await expect(
      rejectedUpgrade({ protocol: "another-protocol" }),
    ).resolves.toBe(403);
    await expect(
      rejectedUpgrade({ origin: "https://attacker.example" }),
    ).resolves.toBe(403);

    const figmaOriginClient = await openClient({
      origin: "https://www.figma.com",
    });
    clients.push(figmaOriginClient);
    expect(figmaOriginClient.protocol).toBe(BRIDGE_SUBPROTOCOL);
  });

  it("does not expose plugin RPC before authentication", async () => {
    const client = await openClient();
    clients.push(client);

    await expect(
      gateway.request("status", {}, { timeoutMs: 250 }),
    ).rejects.toMatchObject({
      name: "BridgeError",
      code: "PAIRING_REQUIRED",
      retryable: true,
    });

    const response = nextJson(client);
    client.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: "request",
        id: "unauthenticated-request",
        method: "status",
        payload: {},
      }),
    );

    await expect(response).resolves.toMatchObject({
      type: "auth_result",
      ok: false,
      error: {
        code: "PROTOCOL_MISMATCH",
      },
    });
  });

  it("pairs once, issues a token, and accepts that token on reconnect", async () => {
    const pluginInstallationId = "plugin-token-roundtrip";
    const paired = await pairClient(gateway, pluginInstallationId);
    clients.push(paired.client);

    expect(paired.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(gateway.status()).toMatchObject({
      paired: true,
      connected: true,
      pluginInstallationId,
    });

    await closeClient(paired.client);
    const reconnected = await openClient();
    clients.push(reconnected);
    const response = nextJson(reconnected);
    reconnected.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: "auth",
        mode: "token",
        token: paired.token,
        pluginInstallationId,
      }),
    );

    await expect(response).resolves.toEqual({
      v: PROTOCOL_VERSION,
      type: "auth_result",
      ok: true,
    });
    expect(gateway.status()).toMatchObject({
      paired: true,
      connected: true,
      pluginInstallationId,
    });
  });

  it("round-trips an RPC request and its correlated response", async () => {
    const paired = await pairClient(gateway, "plugin-rpc-roundtrip");
    clients.push(paired.client);

    const requestMessage = nextJson(paired.client);
    const resultPromise = gateway.request(
      "get_selection",
      { includeCharacters: false },
      { timeoutMs: 2_000 },
    );
    const request = await requestMessage;

    expect(request).toMatchObject({
      v: PROTOCOL_VERSION,
      type: "request",
      id: expect.any(String),
      method: "get_selection",
      payload: { includeCharacters: false },
    });

    paired.client.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: "response",
        id: request.id,
        ok: true,
        result: selectionResult(),
      }),
    );

    await expect(resultPromise).resolves.toEqual(selectionResult());
  });

  it("rejects a structurally invalid plugin result", async () => {
    const paired = await pairClient(gateway, "plugin-invalid-result");
    clients.push(paired.client);

    const requestMessage = nextJson(paired.client);
    const resultPromise = gateway.request(
      "get_selection",
      { includeCharacters: false },
      { timeoutMs: 2_000 },
    );
    const request = await requestMessage;

    paired.client.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: "response",
        id: request.id,
        ok: true,
        result: {},
      }),
    );

    await expect(resultPromise).rejects.toMatchObject({
      name: "BridgeError",
      code: "INVALID_PLUGIN_RESPONSE",
    });
  });

  it("serializes plugin RPC requests in FIFO order", async () => {
    const paired = await pairClient(gateway, "plugin-fifo");
    clients.push(paired.client);

    const firstMessage = nextJson(paired.client);
    const firstResult = gateway.request(
      "get_selection",
      { includeCharacters: false },
      { timeoutMs: 2_000 },
    );
    const secondResult = gateway.request(
      "get_selection",
      { includeCharacters: false },
      { timeoutMs: 2_000 },
    );
    const firstRequest = await firstMessage;
    const secondMessage = nextJson(paired.client);
    const arrivedEarly = await Promise.race([
      secondMessage.then(() => true),
      new Promise<false>((resolve) =>
        setTimeout(() => resolve(false), 50),
      ),
    ]);
    expect(arrivedEarly).toBe(false);

    paired.client.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: "response",
        id: firstRequest.id,
        ok: true,
        result: selectionResult(),
      }),
    );
    await expect(firstResult).resolves.toEqual(selectionResult());

    const secondRequest = await secondMessage;
    paired.client.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: "response",
        id: secondRequest.id,
        ok: true,
        result: selectionResult(),
      }),
    );
    await expect(secondResult).resolves.toEqual(selectionResult());
  });

  it("rejects in-flight RPC when the authenticated plugin disconnects", async () => {
    const paired = await pairClient(gateway, "plugin-disconnect-test");
    clients.push(paired.client);

    const requestMessage = nextJson(paired.client);
    const resultPromise = gateway.request(
      "audit_typography",
      { scope: "selection" },
      { timeoutMs: 2_000 },
    );
    await requestMessage;
    paired.client.terminate();

    await expect(resultPromise).rejects.toMatchObject({
      name: "BridgeError",
      code: "PLUGIN_DISCONNECTED",
      retryable: true,
    });
    expect(gateway.status().connected).toBe(false);
  });

  it("fails explicitly instead of selecting another port when the configured port is occupied", async () => {
    const occupiedPort = Number(new URL(activeBridgeUrl).port);
    const secondGateway = new PluginGateway(
      new PairingStore(join(temporaryDirectory, "second-credentials.json")),
      { port: occupiedPort },
    );

    await expect(secondGateway.start()).rejects.toMatchObject({
      name: "BridgeError",
      code: "PLUGIN_BUSY",
      message: expect.stringContaining(String(occupiedPort)),
    });
    await secondGateway.close();
  });

  it("keeps the production endpoint fixed when no test override is supplied", () => {
    const defaultGateway = new PluginGateway(
      new PairingStore(join(temporaryDirectory, "default-credentials.json")),
    );

    expect(defaultGateway.status()).toMatchObject({
      endpoint: BRIDGE_URL,
      listening: false,
    });
    expect(BRIDGE_PORT).toBe(3_847);
  });
});
