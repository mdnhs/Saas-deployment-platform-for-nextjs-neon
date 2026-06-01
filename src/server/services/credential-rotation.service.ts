import "server-only";
import { open, seal, currentKeyVersion, warmKeyCache } from "@/server/security/crypto";
import { findStaleCredentials, rotateCredential } from "@/server/repositories/credentials.repo";
import { logger } from "@/server/security/logger";
import type { Credential } from "@/server/db/schema";

interface RotationSummary {
  scanned: number;
  rotated: number;
  errors: number;
}

function aadFor(c: Credential) {
  return `cred:${c.workspaceId}:${c.provider}:${c.kind}`;
}

/**
 * Re-seal all credentials still encrypted under an old master key version.
 * Safe to run multiple times: credentials already on the current version are
 * skipped by the query. Each re-seal is a `rotateCredential` (atomic soft-delete
 * + insert), so crashes mid-run leave each row consistent — either old or new,
 * never corrupted.
 *
 * Call `warmKeyCache` with both old and new key versions before running so the
 * synchronous `open`/`seal` path can find both.
 */
export async function rotateStaleCredentials(): Promise<RotationSummary> {
  const currentVersion = currentKeyVersion();

  // Pre-warm the new key so seal() can find it.
  await warmKeyCache(currentVersion);

  const stale = await findStaleCredentials({ currentVersion, limit: 100 });
  const summary: RotationSummary = { scanned: stale.length, rotated: 0, errors: 0 };

  logger.info({ scanned: stale.length, targetVersion: currentVersion }, "key_rotation.start");

  for (const cred of stale) {
    try {
      // Pre-warm old key for decryption.
      await warmKeyCache(cred.keyVersion);

      const plaintext = open(
        {
          ciphertext: cred.ciphertext,
          iv: cred.iv,
          authTag: cred.authTag,
          keyVersion: cred.keyVersion,
        },
        aadFor(cred),
      );

      const resealed = seal(plaintext, aadFor(cred));

      await rotateCredential({
        workspaceId: cred.workspaceId,
        provider: cred.provider,
        kind: cred.kind,
        newRow: {
          workspaceId: cred.workspaceId,
          provider: cred.provider,
          kind: cred.kind,
          ciphertext: resealed.ciphertext,
          iv: resealed.iv,
          authTag: resealed.authTag,
          keyVersion: resealed.keyVersion,
          metadata: cred.metadata,
          createdBy: cred.createdBy,
          rotatedAt: new Date(),
        },
      });

      summary.rotated++;
      logger.info(
        { credentialId: cred.id, fromVersion: cred.keyVersion, toVersion: currentVersion },
        "key_rotation.credential_rotated",
      );
    } catch (err) {
      summary.errors++;
      logger.error(
        {
          credentialId: cred.id,
          workspaceId: cred.workspaceId,
          provider: cred.provider,
          err: err instanceof Error ? err.message : String(err),
        },
        "key_rotation.credential_failed",
      );
    }
  }

  logger.info(summary, "key_rotation.done");
  return summary;
}
