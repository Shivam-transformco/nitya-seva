import { Router } from "express";
import { body, idParam, ok, query } from "../../lib/http.js";
import { actorOf, requireRole } from "../../middleware/auth.js";
import * as bin from "../bin/bin.service.js";
import { followupsRouter } from "../followups/followups.routes.js";
import { paymentsRouter } from "../payments/payments.routes.js";
import {
  assignBody,
  counterVisibilityBody,
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

pledgesRouter.get("/:id", async (req, res) => {
  ok(res, await service.detail(actorOf(req), idParam(req)));
});

pledgesRouter.patch("/:id", async (req, res) => {
  ok(res, await service.edit(actorOf(req), idParam(req), body(req, editPledgeBody)));
});

pledgesRouter.delete("/:id", requireRole("admin"), async (req, res) => {
  await bin.deletePledge(actorOf(req), idParam(req), body(req, deleteBody).reason);
  ok(res, null);
});

pledgesRouter.patch("/:id/sevak", async (req, res) => {
  ok(res, await service.editSevak(actorOf(req), idParam(req), body(req, editSevakBody)));
});

pledgesRouter.patch("/:id/status", async (req, res) => {
  const { status, note, correction } = body(req, updateStatusBody);
  ok(res, await service.updateStatus(actorOf(req), idParam(req), status, note, correction));
});

pledgesRouter.post("/:id/status/undo", async (req, res) => {
  ok(res, await service.undoStatus(actorOf(req), idParam(req)));
});

pledgesRouter.patch("/:id/assign", requireRole("admin"), async (req, res) => {
  ok(res, await service.assign(actorOf(req), idParam(req), body(req, assignBody).userId));
});

pledgesRouter.put("/:id/flag", async (req, res) => {
  const { reason, note } = body(req, flagBody);
  ok(res, await service.flag(actorOf(req), idParam(req), reason, note));
});

pledgesRouter.delete("/:id/flag", async (req, res) => {
  ok(res, await service.unflag(actorOf(req), idParam(req)));
});

pledgesRouter.patch("/:id/counter", requireRole("admin"), async (req, res) => {
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
