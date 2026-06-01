import { handle } from "hono/vercel";
import { honoApp } from "@/hono";

export const runtime = "nodejs";

const handler = handle(honoApp);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
