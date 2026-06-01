import { Hono } from "hono";
import { vercelWebhooks } from "./routes/webhooks-vercel";
import { stripeWebhooks } from "./routes/webhooks-stripe";
import { healthRoutes } from "./routes/health";

export const honoApp = new Hono().basePath("/api");

honoApp.route("/health", healthRoutes);
honoApp.route("/webhooks/vercel", vercelWebhooks);
honoApp.route("/webhooks/stripe", stripeWebhooks);

export type HonoApp = typeof honoApp;
