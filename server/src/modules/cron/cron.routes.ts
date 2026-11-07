import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "../../config/env.js";
import { endOfIstDay } from "../../lib/dates.js";
import { forbidden } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import * as notifications from "../notifications/notifications.service.js";
import * as pledgesRepo from "../pledges/pledges.repository.js";
import * as sevaksRepo from "../sevaks/sevaks.repository.js";

function requireCronSecret(req: Request, _res: Response, next: NextFunction) {
  const secret = env().CRON_SECRET;
  const given = Buffer.from(req.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) throw forbidden();
  next();
}

export const cronRouter = Router();
cronRouter.use(requireCronSecret);

/** Daily at 9:00 IST (see vercel.json): remind assignees about follow-ups due today or overdue. */
cronRouter.get("/daily", async (_req, res) => {
  const due = await pledgesRepo.listDue(endOfIstDay());
  const sevaks = await sevaksRepo.findByIds(due.map((p) => p.sevakId));
  let created = 0;
  for (const pledge of due) {
    const sevak = sevaks.get(pledge.sevakId.toHexString());
    if (sevak && (await notifications.followupDue(pledge, sevak))) created++;
  }
  ok(res, { due: due.length, notificationsCreated: created });
});
