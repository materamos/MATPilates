import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMcpServer } from "./mcp-server.js";
import { PairingStore } from "./pairing-store.js";
import { PluginGateway } from "./plugin-gateway.js";

async function resetPairing(): Promise<void> {
  const store = new PairingStore();
  await store.initialize();
  await store.reset();
  process.stderr.write("MAT Figma bridge pairing was reset.\n");
}

async function main(): Promise<void> {
  if (process.argv.includes("--reset-pairing")) {
    await resetPairing();
    return;
  }

  const gateway = new PluginGateway();
  const server = createMcpServer(gateway);
  let closing = false;

  const close = async () => {
    if (closing) return;
    closing = true;
    await Promise.allSettled([server.close(), gateway.close()]);
  };

  process.once("SIGINT", () => void close().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void close().finally(() => process.exit(0)));
  process.stdin.once("end", () => void close());

  try {
    await gateway.start();
    await server.connect(new StdioServerTransport());
  } catch (error) {
    await close();
    throw error;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`MAT Figma bridge failed to start: ${message}\n`);
  process.exitCode = 1;
});
