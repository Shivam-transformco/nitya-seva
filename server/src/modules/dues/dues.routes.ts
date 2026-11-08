import { Router } from "express";
import { body, idParam, ok, parse } from "../../lib/http.js";
import { actorOf } from "../../middleware/auth.js";
import { dueNoteBody, month } from "./dues.schema.js";
import * as service from "./dues.service.js";

/** Mounted at /api/dues. Staff without `pledges.viewAll` only see their own pledges. */
export const duesRouter = Router();

duesRouter.get("/overdue", async (req, res) => {
  ok(res, await service.overdue(actorOf(req)));
});

duesRouter.get("/month/:month", async (req, res) => {
  ok(res, await service.month(actorOf(req), parse(month, req.params.month)));
});

/** Mounted at /api/pledges/:id/dues. */
export const pledgeDuesRouter = Router({ mergeParams: true });

pledgeDuesRouter.put("/:month", async (req, res) => {
  await service.setNote(actorOf(req), idParam(req), parse(month, req.params.month), body(req, dueNoteBody));
  ok(res, null);
});

pledgeDuesRouter.delete("/:month", async (req, res) => {
  await service.removeNote(actorOf(req), idParam(req), parse(month, req.params.month));
  ok(res, null);
});
