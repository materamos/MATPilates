import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  CREDENTIALS_DIRECTORY,
  CREDENTIALS_FILE,
  MAX_PAIRING_ATTEMPTS,
  PAIRING_CODE_TTL_MS,
  PAIRING_LOCK_MS,
} from "../../shared/constants.js";
import { BridgeError } from "./errors.js";

interface StoredCredentials {
  version: 1;
  serverInstallationId: string;
  pluginInstallationId: string;
  tokenHash: string;
  pairedAt: string;
}

interface PairingWindow {
  code: string;
  expiresAt: number;
  failedAttempts: number;
}

function tokenHash(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

export function credentialsPath(): string {
  const base =
    process.env.LOCALAPPDATA ??
    join(homedir(), ".local", "share");
  return join(base, ...CREDENTIALS_DIRECTORY, CREDENTIALS_FILE);
}

export class PairingStore {
  private readonly filePath: string;
  private credentials: StoredCredentials | null = null;
  private pairingWindow: PairingWindow | null = null;
  private lockedUntil = 0;
  private initialized = false;

  constructor(filePath = credentialsPath()) {
    this.filePath = filePath;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        (parsed as StoredCredentials).version === 1 &&
        typeof (parsed as StoredCredentials).tokenHash === "string"
      ) {
        this.credentials = parsed as StoredCredentials;
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw new BridgeError(
          "INTERNAL_ERROR",
          "Stored bridge credentials could not be read.",
          { cause: error },
        );
      }
    }
    this.initialized = true;
  }

  get isPaired(): boolean {
    return this.credentials !== null;
  }

  get serverInstallationId(): string {
    return this.credentials?.serverInstallationId ?? "not-paired";
  }

  getPairingCode(now = Date.now()): { code: string; expiresAt: string } {
    if (now < this.lockedUntil) {
      throw new BridgeError(
        "PAIRING_RATE_LIMITED",
        "Pairing is temporarily locked after too many failed attempts.",
        { retryable: true },
      );
    }

    if (this.pairingWindow && this.pairingWindow.expiresAt > now) {
      return {
        code: this.pairingWindow.code,
        expiresAt: new Date(this.pairingWindow.expiresAt).toISOString(),
      };
    }

    this.pairingWindow = {
      code: randomInt(0, 1_000_000).toString().padStart(6, "0"),
      expiresAt: now + PAIRING_CODE_TTL_MS,
      failedAttempts: 0,
    };
    return {
      code: this.pairingWindow.code,
      expiresAt: new Date(this.pairingWindow.expiresAt).toISOString(),
    };
  }

  async pair(
    code: string,
    pluginInstallationId: string,
    now = Date.now(),
  ): Promise<{ token: string; serverInstallationId: string }> {
    if (now < this.lockedUntil) {
      throw new BridgeError(
        "PAIRING_RATE_LIMITED",
        "Pairing is temporarily locked after too many failed attempts.",
        { retryable: true },
      );
    }

    const window = this.pairingWindow;
    if (!window || window.expiresAt <= now || window.code !== code) {
      if (window) window.failedAttempts += 1;
      if (window && window.failedAttempts >= MAX_PAIRING_ATTEMPTS) {
        this.pairingWindow = null;
        this.lockedUntil = now + PAIRING_LOCK_MS;
      }
      throw new BridgeError(
        window?.expiresAt && window.expiresAt <= now
          ? "PAIRING_REQUIRED"
          : "PAIRING_REQUIRED",
        "The pairing code is invalid or expired.",
        { retryable: true },
      );
    }

    const token = randomBytes(32).toString("base64url");
    const credentials: StoredCredentials = {
      version: 1,
      serverInstallationId:
        this.credentials?.serverInstallationId ?? randomUUID(),
      pluginInstallationId,
      tokenHash: tokenHash(token).toString("hex"),
      pairedAt: new Date(now).toISOString(),
    };
    await this.writeCredentials(credentials);
    this.credentials = credentials;
    this.pairingWindow = null;
    this.lockedUntil = 0;
    return { token, serverInstallationId: credentials.serverInstallationId };
  }

  verifyToken(token: string, pluginInstallationId: string): boolean {
    if (!this.credentials) return false;
    if (this.credentials.pluginInstallationId !== pluginInstallationId) {
      return false;
    }

    let supplied: Buffer;
    let stored: Buffer;
    try {
      supplied = tokenHash(token);
      stored = Buffer.from(this.credentials.tokenHash, "hex");
    } catch {
      return false;
    }

    return supplied.length === stored.length && timingSafeEqual(supplied, stored);
  }

  async reset(): Promise<void> {
    await rm(this.filePath, { force: true });
    this.credentials = null;
    this.pairingWindow = null;
    this.lockedUntil = 0;
    this.initialized = true;
  }

  private async writeCredentials(credentials: StoredCredentials): Promise<void> {
    const directory = dirname(this.filePath);
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(
      temporaryPath,
      `${JSON.stringify(credentials, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await rename(temporaryPath, this.filePath);
  }
}
