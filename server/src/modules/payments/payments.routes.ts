import { Router } from "express";
import { body, idParam, ok } from "../../lib/http.js";
import { actorOf } from "../../middleware/auth.js";
import { createPaymentBody } from "./payments.schema.js";
import * as service from "./payments.service.js";

/** Mounted at /api/pledges/:id/payments. */
export const paymentsRouter = Router({ mergeParams: true });

paymentsRouter.get("/", async (req, res) => {
  ok(res, await service.list(actorOf(req), idParam(req)));
});

paymentsRouter.post("/", async (req, res) => {
  ok(res, await service.create(actorOf(req), idParam(req), body(req, createPaymentBody)), 201);
});
