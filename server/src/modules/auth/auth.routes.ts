import { Router, type CookieOptions, type Response } from "express";
import { z } from "zod";
import { isProduction } from "../../config/env.js";
import { body, clientIp, ok } from "../../lib/http.js";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "../../lib/tokens.js";
import { actorOf, requireAuth } from "../../middleware/auth.js";
import { password } from "../users/users.schema.js";
import * as service from "./auth.service.js";

const loginBody = z.object({ email: z.email().max(200), password: z.string().min(1).max(200) });
const changePasswordBody = z.object({ currentPassword: z.string().min(1).max(200), newPassword: password });

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: "lax",
  path: "/api",
});

function setSession(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 });
}

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = body(req, loginBody);
  const { token, user } = await service.login(email, password, clientIp(req));
  setSession(res, token);
  ok(res, user);
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  ok(res, null);
});

authRouter.get("/me", requireAuth, async (req, res) => {
  ok(res, await service.me(actorOf(req).id));
});

authRouter.post("/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = body(req, changePasswordBody);
  const { token, user } = await service.changePassword(actorOf(req).id, currentPassword, newPassword);
  setSession(res, token);
  ok(res, user);
});
