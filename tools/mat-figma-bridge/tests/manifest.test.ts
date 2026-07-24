import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  BRIDGE_CLIENT_HOST,
  BRIDGE_HOST,
  BRIDGE_PORT,
  BRIDGE_URL,
} from "../shared/constants";

describe("Figma development manifest", () => {
  it("uses Figma-compatible localhost URLs while the server stays on IPv4 loopback", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../plugin/manifest.json", import.meta.url), "utf8"),
    ) as {
      networkAccess: {
        allowedDomains: string[];
        devAllowedDomains: string[];
      };
    };

    expect(BRIDGE_HOST).toBe("127.0.0.1");
    expect(BRIDGE_CLIENT_HOST).toBe("localhost");
    expect(BRIDGE_URL).toBe(
      `ws://localhost:${BRIDGE_PORT}/mat-figma-bridge`,
    );
    expect(manifest.networkAccess.allowedDomains).toEqual(["none"]);
    expect(manifest.networkAccess.devAllowedDomains).toEqual([
      `http://localhost:${BRIDGE_PORT}`,
      `ws://localhost:${BRIDGE_PORT}`,
    ]);
    expect(
      manifest.networkAccess.devAllowedDomains.map(
        (domain) => new URL(domain).hostname,
      ),
    ).toEqual(["localhost", "localhost"]);
  });
});
