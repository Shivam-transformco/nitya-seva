import { Router } from "express";
import { body, idParam, ok, query } from "../../lib/http.js";
import { actorOf, requirePermission } from "../../middleware/auth.js";
import * as bin from "../bin/bin.service.js";
import { pledgeDuesRouter } from "../dues/dues.routes.js";
import { followupsRouter } from "../followups/followups.routes.js";
import { paymentsRouter } from "../payments/payments.routes.js";
import {
  assignBody,
  counterVisibilityBody,
  createPledgeBody,
  deleteBody,
  editPledgeBody,
  editSevakBody,
  flagBody,
  listPledgesQuery,
  paymentSetupBody,
  updateStatusBody,
} from "./pledges.schema.js";
import * as service from "./pledges.service.js";

export const pledgesRouter = Router();

pledgesRouter.get("/", async (req, res) => {
  ok(res, await service.list(actorOf(req), query(req, listPledgesQuery)));
});

pledgesRouter.post("/", requirePermission("pledges.manage"), async (req, res) => {
  ok(res, await service.create(actorOf(req), body(req, createPledgeBody)), 201);
});

pledgesRouter.get("/:id", async (req, res) => {
  ok(res, await service.detail(actorOf(req), idParam(req)));
});

pledgesRouter.patch("/:id", async (req, res) => {
  ok(res, await service.edit(actorOf(req), idParam(req), body(req, editPledgeBody)));
});

pledgesRouter.delete("/:id", requirePermission("pledges.manage"), async (req, res) => {
  await bin.deletePledge(actorOf(req), idParam(req), body(req, deleteBody).reason);
  ok(res, null);
});

pledgesRouter.patch("/:id/sevak", async (req, res) => {
  ok(res, await service.editSevak(actorOf(req), idParam(req), body(req, editSevakBody)));
});

pledgesRouter.patch("/:id/status", async (req, res) => {
  ok(res, await service.updateStatus(actorOf(req), idParam(req), body(req, updateStatusBody)));
});

pledgesRouter.post("/:id/status/undo", async (req, res) => {
  ok(res, await service.undoStatus(actorOf(req), idParam(req)));
});

pledgesRouter.patch("/:id/assign", requirePermission("pledges.manage"), async (req, res) => {
  ok(res, await service.assign(actorOf(req), idParam(req), body(req, assignBody).userId));
});

pledgesRouter.put("/:id/flag", async (req, res) => {
  const { reason, note } = body(req, flagBody);
  ok(res, await service.flag(actorOf(req), idParam(req), reason, note));
});

pledgesRouter.delete("/:id/flag", async (req, res) => {
  ok(res, await service.unflag(actorOf(req), idParam(req)));
});

pledgesRouter.patch("/:id/counter", requirePermission("pledges.manage"), async (req, res) => {
  ok(res, await service.setCounterVisibility(actorOf(req), idParam(req), body(req, counterVisibilityBody).hidden));
});

pledgesRouter.put("/:id/payment-setup", async (req, res) => {
  ok(res, await service.setPaymentSetup(actorOf(req), idParam(req), body(req, paymentSetupBody)));
});

pledgesRouter.delete("/:id/payment-setup", async (req, res) => {
  ok(res, await service.clearPaymentSetup(actorOf(req), idParam(req)));
});

pledgesRouter.use("/:id/followups", followupsRouter);
pledgesRouter.use("/:id/payments", paymentsRouter);
pledgesRouter.use("/:id/dues", pledgeDuesRouter);
