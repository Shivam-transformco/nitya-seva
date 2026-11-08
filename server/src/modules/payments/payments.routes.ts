import { Router } from "express";
import { body, idParam, ok } from "../../lib/http.js";
import { actorOf } from "../../middleware/auth.js";
import { deletePayment } from "../bin/bin.service.js";
import { deleteBody } from "../pledges/pledges.schema.js";
import { bulkPaymentBody, createPaymentBody } from "./payments.schema.js";
import * as service from "./payments.service.js";

/** Mounted at /api/pledges/:id/payments. */
export const paymentsRouter = Router({ mergeParams: true });

paymentsRouter.get("/", async (req, res) => {
  ok(res, await service.list(actorOf(req), idParam(req)));
});

paymentsRouter.post("/", async (req, res) => {
  ok(res, await service.create(actorOf(req), idParam(req), body(req, createPaymentBody)), 201);
});

paymentsRouter.post("/bulk", async (req, res) => {
  ok(res, await service.createMany(actorOf(req), idParam(req), body(req, bulkPaymentBody)), 201);
});

paymentsRouter.delete("/:paymentId", async (req, res) => {
  await deletePayment(actorOf(req), idParam(req), idParam(req, "paymentId"), body(req, deleteBody).reason);
  ok(res, null);
});
