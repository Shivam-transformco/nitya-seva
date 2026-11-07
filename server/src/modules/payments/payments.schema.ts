import { z } from "zod";
import { PAYMENT_METHODS } from "../../domain/types.js";
import { MONTH_RE } from "../../lib/dates.js";

export const createPaymentBody = z.object({
  amount: z.number().int().min(1).max(10_00_000),
  month: z.string().regex(MONTH_RE, "must look like 2026-11"),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(200).default(""),
  receivedAt: z.coerce
    .date()
    .refine((d) => d.getTime() <= Date.now() + 60_000, "can't be in the future")
    .optional(),
});
