import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { dbEnv } from "./env";
import * as schema from "./schema";

// Always use the `ws` package — Node's native WebSocket (22+) intermittently
// fails the Neon WS upgrade ("fetch failed") under undici, especially on
// IPv6-preferred Linux. `ws` works deterministically on every Node version.
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: dbEnv.DATABASE_URL });

export const db = drizzle(pool, {
  schema,
  logger: dbEnv.NODE_ENV === "development",
});

export type Db = typeof db;
export { pool, schema };
