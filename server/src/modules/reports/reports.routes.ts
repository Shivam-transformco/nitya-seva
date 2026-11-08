import { Router } from "express";
import { z } from "zod";
import { addMonths, istMonth, MONTH_RE } from "../../lib/dates.js";
import { badRequest } from "../../lib/errors.js";
import { ok, query } from "../../lib/http.js";
import { requirePermission } from "../../middleware/auth.js";
import * as dues from "../dues/dues.service.js";
import * as service from "./reports.service.js";

const monthRange = z.object({
  from: z.string().regex(MONTH_RE).optional(),
  to: z.string().regex(MONTH_RE).optional(),
});

const dateRange = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Mounted behind `reports.view`. */
export const reportsRouter = Router();

reportsRouter.get("/summary", async (_req, res) => {
  ok(res, await service.summary());
});

reportsRouter.get("/collections", async (req, res) => {
  const q = query(req, monthRange);
  const to = q.to ?? istMonth();
  const from = q.from ?? istMonth(new Date(Date.now() - 365 * DAY_MS));
  ok(res, { from, to, months: await service.monthlyCollections(from, to) });
});

reportsRouter.get("/dues", async (req, res) => {
  const q = query(req, monthRange);
  const to = q.to ?? istMonth();
  const from = q.from ?? addMonths(to, -11);
  if (from > to || addMonths(from, 36) < to) throw badRequest("Pick up to three years, with 'from' before 'to'.");
  ok(res, await dues.monthly(from, to));
});

reportsRouter.get("/this-month", async (_req, res) => {
  ok(res, await dues.thisMonth());
});

reportsRouter.get("/payment-modes", async (req, res) => {
  const q = query(req, monthRange);
  const to = q.to ?? istMonth();
  const from = q.from ?? istMonth(new Date(Date.now() - 365 * DAY_MS));
  ok(res, { from, to, ...(await service.paymentModes(from, to)) });
});

reportsRouter.get("/activity", async (req, res) => {
  const q = query(req, dateRange);
  const to = q.to ?? new Date();
  const from = q.from ?? new Date(to.getTime() - 30 * DAY_MS);
  ok(res, { from, to, users: await service.activity(from, to) });
});

reportsRouter.get("/pledges.csv", requirePermission("reports.export"), async (_req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="nitya-seva-pledges-${istMonth()}.csv"`);
  res.write("\uFEFF"); // BOM so Excel reads UTF-8 (₹, Devanagari) correctly
  for await (const chunk of service.pledgesCsv()) res.write(chunk);
  res.end();
});
