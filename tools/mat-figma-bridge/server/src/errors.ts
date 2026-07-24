import { randomUUID } from "node:crypto";

import type { PublicErrorCode } from "../../shared/protocol.js";

export class BridgeError extends Error {
  public readonly code: PublicErrorCode;
  public readonly retryable: boolean;
  public readonly correlationId?: string;

  constructor(
    code: PublicErrorCode,
    message: string,
    options: { retryable?: boolean; correlationId?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "BridgeError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.correlationId = options.correlationId;
  }
}

export function toBridgeError(error: unknown): BridgeError {
  if (error instanceof BridgeError) return error;

  const correlationId = randomUUID();
  const category = error instanceof Error ? error.name : typeof error;
  process.stderr.write(
    `[mat-figma-bridge:${correlationId}] Internal ${category} failure.\n`,
  );

  return new BridgeError("INTERNAL_ERROR", "The bridge encountered an internal error.", {
    correlationId,
  });
}
