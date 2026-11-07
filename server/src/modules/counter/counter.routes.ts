import { Router } from "express";
import { body, idParam, ok } from "../../lib/http.js";
import { actorOf } from "../../middleware/auth.js";
import { createAdjustmentBody, updateAdjustmentBody } from "./counter.schema.js";
import * as service from "./counter.service.js";

/** Mounted behind requireRole("admin"). */
export const counterRouter = Router();

counterRouter.get("/", async (_req, res) => {
  ok(res, await service.breakdown());
});

counterRouter.post("/adjustments", async (req, res) => {
  ok(res, await service.createAdjustment(actorOf(req), body(req, createAdjustmentBody)), 201);
});

counterRouter.patch("/adjustments/:id", async (req, res) => {
  ok(res, await service.updateAdjustment(actorOf(req), idParam(req), body(req, updateAdjustmentBody)));
});

counterRouter.delete("/adjustments/:id", async (req, res) => {
  await service.removeAdjustment(actorOf(req), idParam(req));
  ok(res, null);
});
