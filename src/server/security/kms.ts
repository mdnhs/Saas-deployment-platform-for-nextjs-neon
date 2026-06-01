import "server-only";
import { KMSClient, DecryptCommand } from "@aws-sdk/client-kms";

/**
 * KMS-based master-key loader. Called by `crypto.ts` when KMS is configured.
 *
 * Env vars:
 *   KMS_REGION           — AWS region (default: us-east-1)
 *   KMS_ENCRYPTED_KEY_V<n> — base64-encoded CiphertextBlob produced by:
 *       aws kms encrypt --key-id <arn> --plaintext fileb://<(openssl rand 32) \
 *         --output text --query CiphertextBlob
 *
 * The decrypted 32-byte plaintext is cached in memory for the process lifetime.
 * A Lambda cold-start or K8s pod restart is the key-rotation boundary — no
 * plaintext key ever touches disk.
 */

const cache = new Map<number, Buffer>();
let _client: KMSClient | null = null;

function client(): KMSClient {
  if (_client) return _client;
  _client = new KMSClient({ region: process.env.KMS_REGION ?? "us-east-1" });
  return _client;
}

export async function loadKeyFromKms(version: number): Promise<Buffer> {
  const cached = cache.get(version);
  if (cached) return cached;

  const blob = process.env[`KMS_ENCRYPTED_KEY_V${version}`];
  if (!blob) {
    throw new Error(`KMS_ENCRYPTED_KEY_V${version} is not set`);
  }

  const ciphertextBlob = Buffer.from(blob, "base64");
  const { Plaintext } = await client().send(
    new DecryptCommand({ CiphertextBlob: ciphertextBlob }),
  );

  if (!Plaintext || Plaintext.length !== 32) {
    throw new Error(
      `KMS decrypt for key version ${version} returned ${Plaintext?.length ?? 0} bytes; expected 32`,
    );
  }

  const key = Buffer.from(Plaintext);
  cache.set(version, key);
  return key;
}

/** Exposed for the rotation job to pre-warm the new key before switching. */
export function bustKmsCache(): void {
  cache.clear();
  _client = null;
}
