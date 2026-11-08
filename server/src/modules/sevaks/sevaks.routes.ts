import { Router } from "express";
import { z } from "zod";
import { body, idParam, objectId, ok, query } from "../../lib/http.js";
import { actorOf } from "../../middleware/auth.js";
import * as service from "./sevaks.service.js";

/** Mounted at /api/sevaks behind `pledges.manage`. */
export const sevaksRouter = Router();

sevaksRouter.get("/", async (req, res) => {
  ok(res, await service.search(query(req, z.object({ q: z.string().trim().min(2).max(100) })).q));
});

/** Merges sevak `from` into `:id`. */
sevaksRouter.post("/:id/merge", async (req, res) => {
  ok(res, await service.merge(actorOf(req), idParam(req), body(req, z.object({ from: objectId })).from));
});
