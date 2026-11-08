import { Router, type NextFunction, type Request, type Response } from "express";
import { can } from "../../domain/permissions.js";
import { forbidden } from "../../lib/errors.js";
import { body, idParam, ok } from "../../lib/http.js";
import { actorOf, requirePermission } from "../../middleware/auth.js";
import { createUserBody, updateUserBody } from "./users.schema.js";
import * as service from "./users.service.js";

export const usersRouter = Router();

/** Anyone who sees all pledges needs the staff names for the assignee filter. */
function canListStaff(req: Request, _res: Response, next: NextFunction) {
  const { role } = actorOf(req);
  if (!can(role, "staff.manage") && !can(role, "pledges.viewAll")) throw forbidden();
  next();
}

usersRouter.get("/", canListStaff, async (_req, res) => {
  ok(res, await service.list());
});

usersRouter.post("/", requirePermission("staff.manage"), async (req, res) => {
  ok(res, await service.create(actorOf(req), body(req, createUserBody)), 201);
});

usersRouter.patch("/:id", requirePermission("staff.manage"), async (req, res) => {
  ok(res, await service.update(actorOf(req), idParam(req), body(req, updateUserBody)));
});
