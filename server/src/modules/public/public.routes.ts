import { Router } from "express";
import { body, clientIp } from "../../lib/http.js";
import { submitBody } from "./public.schema.js";
import * as service from "./public.service.js";

// These keep the exact response shapes the public site already relies on.
export const publicRouter = Router();

publicRouter.get("/health", async (_req, res) => {
  const db = await service.health();
  res.status(db ? 200 : 503).json({ ok: db, db: db ? "up" : "down" });
});

publicRouter.get("/stats", async (_req, res) => {
  res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.json({ ok: true, ...(await service.stats()) });
});

publicRouter.post("/submit", async (req, res) => {
  const input = body(req, submitBody);
  await service.submit(input, { ip: clientIp(req), userAgent: req.get("user-agent") ?? "" });
  res.json({ ok: true });
});
