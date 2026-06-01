import "server-only";
import { z } from "zod";
import { seal, open, currentKeyVersion, CryptoError } from "@/server/security/crypto";
import {
  findActiveCredential,
  insertCredential,
  rotateCredential,
} from "@/server/repositories/credentials.repo";
import type {
  Credential,
  CredentialKind,
  CredentialProvider,
} from "@/server/db/schema";
import { logger } from "@/server/security/logger";

export class CredentialServiceError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "NOT_FOUND"
      | "DECRYPT_FAILED"
      | "MASTER_KEY_MISSING",
    message: string,
  ) {
    super(message);
    this.name = "CredentialServiceError";
  }
}

const storeSchema = z.object({
  workspaceId: z.string().uuid(),
  provider: z.enum(["vercel", "neon", "github"]),
  kind: z.enum(["api_key", "oauth_token", "service_account"]),
  plaintext: z.string().min(1).max(8192),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdBy: z.string().min(1),
});

function aadFor(workspaceId: string, provider: CredentialProvider, kind: CredentialKind) {
  return `cred:${workspaceId}:${provider}:${kind}`;
}

/**
 * Seal a plaintext credential and persist it. If an active credential already
 * exists for `(workspaceId, provider, kind)`, the existing one is soft-deleted
 * and the new one inserted atomically — `credentials_active_unique` (partial
 * index) holds at most one active row.
 *
 * `metadata` is non-sensitive context (team slug, account email, etc.) shown
 * in the UI so admins can see *which* credential is configured without ever
 * triggering decryption.
 */
export async function storeCredential(input: z.input<typeof storeSchema>): Promise<Credential> {
  const parsed = storeSchema.safeParse(input);
  if (!parsed.success) {
    throw new CredentialServiceError("INVALID_INPUT", parsed.error.message);
  }

  let sealed;
  try {
    sealed = seal(parsed.data.plaintext, aadFor(parsed.data.workspaceId, parsed.data.provider, parsed.data.kind));
  } catch (err) {
    if (err instanceof CryptoError && err.code === "NO_KEY") {
      throw new CredentialServiceError(
        "MASTER_KEY_MISSING",
        "MASTER_KEY_V<n> is not configured — see .env.example",
      );
    }
    throw err;
  }

  const existing = await findActiveCredential({
    workspaceId: parsed.data.workspaceId,
    provider: parsed.data.provider,
    kind: parsed.data.kind,
  });

  const row = {
    workspaceId: parsed.data.workspaceId,
    provider: parsed.data.provider,
    kind: parsed.data.kind,
    ciphertext: sealed.ciphertext,
    iv: sealed.iv,
    authTag: sealed.authTag,
    keyVersion: sealed.keyVersion,
    metadata: parsed.data.metadata,
    createdBy: parsed.data.createdBy,
    rotatedAt: existing ? new Date() : null,
  };

  const result = existing
    ? await rotateCredential({
        workspaceId: parsed.data.workspaceId,
        provider: parsed.data.provider,
        kind: parsed.data.kind,
        newRow: row,
      })
    : await insertCredential(row);

  logger.info(
    {
      credentialId: result.id,
      workspaceId: result.workspaceId,
      provider: result.provider,
      kind: result.kind,
      rotated: existing != null,
    },
    "credential.stored",
  );
  return result;
}

/**
 * Decrypt and return the plaintext credential. Caller MUST consume it at the
 * integration boundary (build an authorization header, sign a request, etc.)
 * and never persist, log, or return it to a client.
 *
 * Throws `NOT_FOUND` when no active credential exists — callers can then fall
 * back to an env-level platform credential if their integration supports one.
 */
export async function getCredentialPlaintext(input: {
  workspaceId: string;
  provider: CredentialProvider;
  kind: CredentialKind;
}): Promise<{ plaintext: string; metadata: Record<string, unknown> | null }> {
  const row = await findActiveCredential(input);
  if (!row) {
    throw new CredentialServiceError(
      "NOT_FOUND",
      `no active ${input.provider}/${input.kind} credential for workspace`,
    );
  }

  try {
    const plaintext = open(
      {
        ciphertext: row.ciphertext,
        iv: row.iv,
        authTag: row.authTag,
        keyVersion: row.keyVersion,
      },
      aadFor(row.workspaceId, row.provider, row.kind),
    );
    return { plaintext, metadata: row.metadata };
  } catch (err) {
    logger.error(
      {
        credentialId: row.id,
        workspaceId: row.workspaceId,
        provider: row.provider,
        err: err instanceof Error ? err.message : String(err),
      },
      "credential.decrypt_failed",
    );
    if (err instanceof CryptoError) {
      throw new CredentialServiceError("DECRYPT_FAILED", err.message);
    }
    throw err;
  }
}

/** Diagnostics: confirm a sealed credential decrypts under the current key set. */
export async function probeCredential(input: {
  workspaceId: string;
  provider: CredentialProvider;
  kind: CredentialKind;
}): Promise<boolean> {
  try {
    await getCredentialPlaintext(input);
    return true;
  } catch {
    return false;
  }
}

/** Current master-key version exposed for the settings UI ("rotate" banner). */
export function activeKeyVersion() {
  return currentKeyVersion();
}
