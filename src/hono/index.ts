import { Hono } from "hono";
import { vercelWebhooks } from "./routes/webhooks-vercel";

export const honoApp = new Hono().basePath("/api");

honoApp.get("/health", (c) => c.json({ ok: true }));

honoApp.route("/webhooks/vercel", vercelWebhooks);

export type HonoApp = typeof honoApp;
