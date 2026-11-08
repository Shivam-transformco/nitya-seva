import { Router } from "express";
import { body, idParam, ok } from "../../lib/http.js";
import { actorOf } from "../../middleware/auth.js";
import { deleteBody } from "../pledges/pledges.schema.js";
import { createFollowupBody } from "./followups.schema.js";
import * as service from "./followups.service.js";

/** Mounted at /api/pledges/:id/followups. */
export const followupsRouter = Router({ mergeParams: true });

followupsRouter.get("/", async (req, res) => {
  ok(res, await service.list(actorOf(req), idParam(req)));
});

followupsRouter.post("/", async (req, res) => {
  ok(res, await service.create(actorOf(req), idParam(req), body(req, createFollowupBody)), 201);
});

followupsRouter.delete("/:followupId", async (req, res) => {
  await service.remove(actorOf(req), idParam(req), idParam(req, "followupId"), body(req, deleteBody).reason);
  ok(res, null);
});
