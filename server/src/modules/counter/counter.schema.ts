import { z } from "zod";

const amount = z.number().int().min(-1_00_00_000).max(1_00_00_000);
const sevaks = z.number().int().min(-10_000).max(10_000);

export const createAdjustmentBody = z
  .object({
    label: z.string().trim().min(1).max(100),
    amount: amount.default(0),
    sevaks: sevaks.default(0),
    note: z.string().trim().max(500).default(""),
    active: z.boolean().default(true),
  })
  .refine((b) => b.amount !== 0 || b.sevaks !== 0, { message: "change the amount or the sevak count", path: ["amount"] });

export const updateAdjustmentBody = z
  .object({
    label: z.string().trim().min(1).max(100),
    amount,
    sevaks,
    note: z.string().trim().max(500),
    active: z.boolean(),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, "nothing to update");
