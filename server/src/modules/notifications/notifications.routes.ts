import { Router } from "express";
import { z } from "zod";
import { idParam, ok, pagination, query } from "../../lib/http.js";
import { actorOf } from "../../middleware/auth.js";
import * as service from "./notifications.service.js";

const listQuery = pagination.extend({ unread: z.enum(["true", "false"]).default("false") });

export const notificationsRouter = Router();

notificationsRouter.get("/", async (req, res) => {
  const q = query(req, listQuery);
  ok(res, await service.list(actorOf(req).id, { unreadOnly: q.unread === "true", page: q.page, limit: q.limit }));
});

notificationsRouter.post("/read-all", async (req, res) => {
  ok(res, { updated: await service.markAllRead(actorOf(req).id) });
});

notificationsRouter.post("/:id/read", async (req, res) => {
  await service.markRead(actorOf(req).id, idParam(req));
  ok(res, null);
});
