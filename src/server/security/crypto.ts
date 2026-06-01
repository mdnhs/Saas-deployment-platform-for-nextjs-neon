import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { loadKeyFromKms, bustKmsCache } from "./kms";

/**
 * Envelope encryption — ARCHITECTURE §8 / Invariant #6.
 *
 *  - Algorithm: AES-256-GCM. 256-bit key, 96-bit random IV per seal, 128-bit
 *    auth tag. GCM is authenticated, so tampering with ciphertext, iv, or AAD
 *    raises an exception in `open()`.
 *  - Key material: env vars `MASTER_KEY_V<n>`, base64-encoded 32 bytes. The
 *    *latest* version is read from `MASTER_KEY_CURRENT_VERSION` (default 1).
 *    New keys are layered in by setting `MASTER_KEY_V2=...` and bumping the
 *    pointer; rotation re-seals existing rows in a background job (Phase 7).
 *  - Output shape: ciphertext + iv + auth_tag + key_version. All stored as
 *    bytea/text on `credentials`; never serialized into logs.
 *  - AAD: an optional context string (e.g. `workspaceId:provider:kind`) bound
 *    into the seal so a leaked blob can't be replayed against a different
 *    record.
 *
 * In production the master key lives in KMS; the same `seal`/`open` interface
 * holds — only the key loader changes.
 */

const ALGO = "aes-256-gcm" as const;
const IV_LEN = 12; // 96 bits, GCM spec
const TAG_LEN = 16; // 128 bits
const KEY_LEN = 32; // 256 bits

export interface Sealed {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

export class CryptoError extends Error {
  constructor(
    public readonly code: "NO_KEY" | "DECRYPT_FAILED" | "BAD_INPUT",
    message: string,
  ) {
    super(message);
    this.name = "CryptoError";
  }
}

const USE_KMS = Boolean(process.env.KMS_MASTER_KEY_ARN ?? process.env.KMS_ENCRYPTED_KEY_V1);

/** In-memory key material cache. Populated by `warmKeyCache()` for the KMS path. */
const keyCache = new Map<number, Buffer>();

/**
 * Synchronous key loader. Returns from the in-memory cache first.
 * - Dev/staging: env var `MASTER_KEY_V<n>` (no KMS).
 * - Production: call `warmKeyCache(version)` once at startup; the KMS-fetched
 *   key is then served synchronously from cache — `seal`/`open` stay sync.
 */
function loadKey(version: number): Buffer {
  const cached = keyCache.get(version);
  if (cached) return cached;

  if (USE_KMS) {
    throw new CryptoError(
      "NO_KEY",
      `key V${version} not in cache — call warmKeyCache(${version}) at startup`,
    );
  }
  const raw = process.env[`MASTER_KEY_V${version}`];
  if (!raw) {
    throw new CryptoError("NO_KEY", `MASTER_KEY_V${version} not set`);
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LEN) {
    throw new CryptoError(
      "NO_KEY",
      `MASTER_KEY_V${version} must decode to ${KEY_LEN} bytes (got ${buf.length})`,
    );
  }
  keyCache.set(version, buf);
  return buf;
}

/**
 * Pre-warm the in-memory key cache from KMS (or env var). Call this once
 * per version at application startup (e.g. Next.js `instrumentation.ts`).
 * After warming, `seal`/`open` remain synchronous.
 */
export async function warmKeyCache(version?: number): Promise<void> {
  const v = version ?? currentKeyVersion();
  if (keyCache.has(v)) return;
  if (USE_KMS) {
    const key = await loadKeyFromKms(v);
    keyCache.set(v, key);
  } else {
    loadKey(v); // populates the cache from env
  }
}

/** Purge the in-memory cache — useful after a key rotation. */
export function clearKeyCache(): void {
  keyCache.clear();
  bustKmsCache();
}

export { bustKmsCache };

export function currentKeyVersion(): number {
  const raw = process.env.MASTER_KEY_CURRENT_VERSION ?? "1";
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new CryptoError("NO_KEY", `MASTER_KEY_CURRENT_VERSION invalid: ${raw}`);
  }
  return n;
}

/**
 * Encrypt `plaintext` with the current master key. `aad` binds the ciphertext
 * to its context — callers should pass something stable and unique per record
 * (e.g. `workspaceId:provider:kind`). Mismatched AAD on `open()` fails.
 */
export function seal(plaintext: string | Buffer, aad?: string): Sealed {
  if (plaintext == null) throw new CryptoError("BAD_INPUT", "plaintext is required");
  const version = currentKeyVersion();
  const key = loadKey(version);
  const iv = randomBytes(IV_LEN);

  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));

  const buf = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, "utf8");
  const ciphertext = Buffer.concat([cipher.update(buf), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { ciphertext, iv, authTag, keyVersion: version };
}

export function open(sealed: Sealed, aad?: string): string {
  if (
    !sealed ||
    !Buffer.isBuffer(sealed.ciphertext) ||
    !Buffer.isBuffer(sealed.iv) ||
    !Buffer.isBuffer(sealed.authTag) ||
    !sealed.keyVersion
  ) {
    throw new CryptoError("BAD_INPUT", "sealed input is malformed");
  }
  if (sealed.iv.length !== IV_LEN) {
    throw new CryptoError("BAD_INPUT", `iv must be ${IV_LEN} bytes`);
  }
  if (sealed.authTag.length !== TAG_LEN) {
    throw new CryptoError("BAD_INPUT", `authTag must be ${TAG_LEN} bytes`);
  }

  const key = loadKey(sealed.keyVersion);
  const decipher = createDecipheriv(ALGO, key, sealed.iv, { authTagLength: TAG_LEN });
  if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(sealed.authTag);

  try {
    const plaintext = Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    // Don't leak which step failed; just signal authentication failure.
    throw new CryptoError("DECRYPT_FAILED", "ciphertext authentication failed");
  }
}

/** Constant-time comparison for any pre-shared-secret style checks. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Helper to generate a fresh 32-byte master key (base64). Use:
 *   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
 * Exposed here so the value can be derived from one place at test time too.
 */
export function generateMasterKeyBase64(): string {
  return randomBytes(KEY_LEN).toString("base64");
}
