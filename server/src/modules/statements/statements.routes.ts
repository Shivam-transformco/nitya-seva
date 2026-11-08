import { Router } from "express";
import { z } from "zod";
import { financialYearOf } from "../../lib/dates.js";
import { idParam, ok, query } from "../../lib/http.js";
import * as service from "./statements.service.js";

const fyQuery = z.object({
  /** The year the financial year starts in (2025 = April 2025 to March 2026). */
  fy: z.coerce.number().int().min(2000).max(2100).optional(),
  q: z.string().trim().min(2).max(100).optional(),
});

/** Mounted behind `payments.manage`. */
export const statementsRouter = Router();

statementsRouter.get("/", async (req, res) => {
  const q = query(req, fyQuery);
  ok(res, await service.list(q.fy ?? financialYearOf(), q.q));
});

statementsRouter.get("/:id", async (req, res) => {
  const q = query(req, fyQuery);
  ok(res, await service.forSevak(idParam(req), q.fy ?? financialYearOf()));
});
