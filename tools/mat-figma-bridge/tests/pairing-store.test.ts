import { access, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MAX_PAIRING_ATTEMPTS,
  PAIRING_CODE_TTL_MS,
  PAIRING_LOCK_MS,
} from "../shared/constants.js";
import { PairingStore } from "../server/src/pairing-store.js";

function differentPairingCode(code: string): string {
  return ((Number(code) + 1) % 1_000_000).toString().padStart(6, "0");
}

describe("PairingStore", () => {
  let temporaryDirectory: string;
  let credentialsFile: string;
  let store: PairingStore;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), "mat-figma-pairing-store-"),
    );
    credentialsFile = join(temporaryDirectory, "credentials.json");
    store = new PairingStore(credentialsFile);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("reuses an active six-digit pairing code", () => {
    const now = 1_750_000_000_000;
    const first = store.getPairingCode(now);
    const reused = store.getPairingCode(now + PAIRING_CODE_TTL_MS - 1);

    expect(first.code).toMatch(/^\d{6}$/);
    expect(reused).toEqual(first);
    expect(first.expiresAt).toBe(
      new Date(now + PAIRING_CODE_TTL_MS).toISOString(),
    );
  });

  it("rejects a code at its expiration boundary", async () => {
    const now = 1_750_000_000_000;
    const pairing = store.getPairingCode(now);

    await expect(
      store.pair(
        pairing.code,
        "plugin-expiration-test",
        now + PAIRING_CODE_TTL_MS,
      ),
    ).rejects.toMatchObject({
      name: "BridgeError",
      code: "PAIRING_REQUIRED",
      retryable: true,
    });

    expect(store.isPaired).toBe(false);
  });

  it("locks pairing after five failed attempts and unlocks after the cooldown", async () => {
    const now = 1_750_000_000_000;
    const pairing = store.getPairingCode(now);
    const incorrectCode = differentPairingCode(pairing.code);

    for (let attempt = 0; attempt < MAX_PAIRING_ATTEMPTS; attempt += 1) {
      await expect(
        store.pair(
          incorrectCode,
          "plugin-rate-limit-test",
          now + attempt,
        ),
      ).rejects.toMatchObject({
        code: "PAIRING_REQUIRED",
      });
    }

    expect(() =>
      store.getPairingCode(now + MAX_PAIRING_ATTEMPTS),
    ).toThrowError(
      expect.objectContaining({
        code: "PAIRING_RATE_LIMITED",
        retryable: true,
      }),
    );

    const afterCooldown = store.getPairingCode(
      now + (MAX_PAIRING_ATTEMPTS - 1) + PAIRING_LOCK_MS,
    );
    expect(afterCooldown.code).toMatch(/^\d{6}$/);
  });

  it("persists a token hash, verifies the token, and never stores the token itself", async () => {
    const now = 1_750_000_000_000;
    const pairing = store.getPairingCode(now);
    const paired = await store.pair(
      pairing.code,
      "plugin-persistence-test",
      now,
    );

    expect(paired.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(store.isPaired).toBe(true);
    expect(
      store.verifyToken(paired.token, "plugin-persistence-test"),
    ).toBe(true);
    expect(store.verifyToken(paired.token, "another-plugin")).toBe(false);
    expect(store.verifyToken("not-the-token", "plugin-persistence-test")).toBe(
      false,
    );

    const serialized = await readFile(credentialsFile, "utf8");
    expect(serialized).not.toContain(paired.token);
    expect(JSON.parse(serialized)).toMatchObject({
      version: 1,
      serverInstallationId: paired.serverInstallationId,
      pluginInstallationId: "plugin-persistence-test",
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      pairedAt: new Date(now).toISOString(),
    });

    const reloaded = new PairingStore(credentialsFile);
    await reloaded.initialize();
    expect(
      reloaded.verifyToken(paired.token, "plugin-persistence-test"),
    ).toBe(true);
  });

  it("revokes the previous token when a new pairing succeeds", async () => {
    const now = 1_750_000_000_000;
    const firstPairing = store.getPairingCode(now);
    const first = await store.pair(
      firstPairing.code,
      "plugin-original",
      now,
    );

    const secondPairing = store.getPairingCode(now + 1);
    const second = await store.pair(
      secondPairing.code,
      "plugin-replacement",
      now + 1,
    );

    expect(second.serverInstallationId).toBe(first.serverInstallationId);
    expect(second.token).not.toBe(first.token);
    expect(store.verifyToken(first.token, "plugin-original")).toBe(false);
    expect(
      store.verifyToken(second.token, "plugin-replacement"),
    ).toBe(true);
  });

  it("reset revokes credentials, clears pairing state, and removes the file", async () => {
    const now = 1_750_000_000_000;
    const pairing = store.getPairingCode(now);
    const paired = await store.pair(
      pairing.code,
      "plugin-reset-test",
      now,
    );

    await store.reset();

    expect(store.isPaired).toBe(false);
    expect(store.serverInstallationId).toBe("not-paired");
    expect(store.verifyToken(paired.token, "plugin-reset-test")).toBe(false);
    await expect(access(credentialsFile)).rejects.toMatchObject({
      code: "ENOENT",
    });

    const nextPairing = store.getPairingCode(now + 1);
    expect(nextPairing.code).toMatch(/^\d{6}$/);
  });
});
