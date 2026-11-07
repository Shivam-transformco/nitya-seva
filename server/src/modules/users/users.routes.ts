import { Router } from "express";
import { body, idParam, ok } from "../../lib/http.js";
import { actorOf } from "../../middleware/auth.js";
import { createUserBody, updateUserBody } from "./users.schema.js";
import * as service from "./users.service.js";

/** Mounted behind requireRole("admin"). */
export const usersRouter = Router();

usersRouter.get("/", async (_req, res) => {
  ok(res, await service.list());
});

usersRouter.post("/", async (req, res) => {
  ok(res, await service.create(actorOf(req), body(req, createUserBody)), 201);
});

usersRouter.patch("/:id", async (req, res) => {
  ok(res, await service.update(actorOf(req), idParam(req), body(req, updateUserBody)));
});
