/**
 * Next.js instrumentation hook — runs once per cold start on the server.
 * We use it to pre-warm the master-key cache so the first `seal`/`open` call
 * never blocks on a KMS round trip. In dev/staging the env-var path populates
 * the cache synchronously; in production KMS is hit once and the plaintext key
 * lives only in memory for the process lifetime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmKeyCache, currentKeyVersion } = await import("./server/security/crypto");
    try {
      const currentVersion = currentKeyVersion();
      await warmKeyCache(currentVersion);
      // Pre-warm any older key versions still referenced by existing credentials.
      // Gaps are fine — loadKey falls through to the env-var path for old versions.
      if (currentVersion > 1) {
        for (let v = 1; v < currentVersion; v++) {
          await warmKeyCache(v).catch(() => {
            // Older key not available → fine unless rotation is in progress.
          });
        }
      }
    } catch (err) {
      // Non-fatal in dev where MASTER_KEY_V1 is not configured; crypto calls
      // will fail at use time with a clear error.
      if (process.env.NODE_ENV === "production") throw err;
    }
  }
}
