import pino from "pino";

/**
 * Redaction paths land here BEFORE any secret-bearing module exists (Invariant #6).
 * Add a path the moment a new secret-shaped field is introduced; assume any path not
 * listed will leak. Wildcards match one segment.
 */
const REDACT_PATHS = [
  "*.password",
  "*.token",
  "*.access_token",
  "*.accessToken",
  "*.refresh_token",
  "*.refreshToken",
  "*.api_key",
  "*.apiKey",
  "*.secret",
  "*.client_secret",
  "*.clientSecret",
  "*.authorization",
  "*.Authorization",
  "*.cookie",
  "*.set-cookie",
  "*.ciphertext",
  "*.iv",
  "*.auth_tag",
  "*.authTag",
  "*.connection_string",
  "*.connectionString",
  "*.dsn",
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  "headers.authorization",
  "headers.cookie",
];

const isProd = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL ?? (isProd ? "info" : "debug");

export const logger = pino({
  level,
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
    remove: false,
  },
  base: { service: "deployment-platform" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, singleLine: false, translateTime: "SYS:standard" },
        },
      }),
});

export type Logger = typeof logger;
