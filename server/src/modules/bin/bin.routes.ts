import { Router } from "express";
import { idParam, ok, query } from "../../lib/http.js";
import { actorOf, requirePermission } from "../../middleware/auth.js";
import { listBinQuery } from "./bin.schema.js";
import * as service from "./bin.service.js";

/** Mounted at /api/deleted behind `bin.manage`. */
export const binRouter = Router();

binRouter.get("/", async (req, res) => {
  ok(res, await service.list(query(req, listBinQuery)));
});

binRouter.post("/:id/restore", async (req, res) => {
  ok(res, await service.restore(actorOf(req), idParam(req)));
});

binRouter.delete("/:id", requirePermission("bin.purge"), async (req, res) => {
  await service.purge(actorOf(req), idParam(req));
  ok(res, null);
});
