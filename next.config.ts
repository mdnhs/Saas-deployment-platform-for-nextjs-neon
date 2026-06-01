import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-auth's kysely-adapter imports symbols that don't exist in newer kysely
  // releases. Since we use the drizzle adapter exclusively, treat the auth
  // package tree as a runtime require so Turbopack/Webpack skip static analysis.
  serverExternalPackages: [
    "better-auth",
    "@better-auth/kysely-adapter",
    "kysely",
    "@aws-sdk/client-kms",
    "stripe",
  ],
};

export default nextConfig;
