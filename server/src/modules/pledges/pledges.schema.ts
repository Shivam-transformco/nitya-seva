import { z } from "zod";
import { AUTO_DEBIT_MODES, MANDATE_STATUSES, PAYMENT_MODES, PLEDGE_FLAGS, PLEDGE_STATUSES } from "../../domain/types.js";
import { MONTH_RE } from "../../lib/dates.js";
import { objectId, pagination } from "../../lib/http.js";
import { sevakEmail, sevakName, sevakPhone } from "../public/public.schema.js";

export const listPledgesQuery = pagination.extend({
  status: z.enum(PLEDGE_STATUSES).optional(),
  assignedTo: z.union([objectId, z.literal("none")]).optional(),
  /** Only pledges whose follow-up is due by the end of today (IST). */
  due: z.enum(["true", "false"]).optional(),
  /** Flagged (not genuine) pledges are left out unless asked for. */
  flagged: z.enum(["true", "false"]).default("false"),
  /** Only pledges hidden from the public counter. */
  hidden: z.enum(["true"]).optional(),
  /** How they pay; "none" = not recorded yet. */
  mode: z.enum([...PAYMENT_MODES, "none"]).optional(),
  mandate: z.enum(MANDATE_STATUSES).optional(),
  q: z.string().trim().min(2).max(100).optional(),
  sort: z.enum(["newest", "oldest", "nextFollowUp"]).default("newest"),
});

export const updateStatusBody = z.object({
  status: z.enum(PLEDGE_STATUSES),
  note: z.string().trim().max(1000).optional(),
  /** Admins may set any status to put a mistake right, outside the usual lifecycle. */
  correction: z.boolean().default(false),
});

export const editPledgeBody = z
  .object({
    amount: z.number().int().min(1).max(10_00_000).optional(),
    seva: z.string().trim().min(1, "is required").max(100).optional(),
    message: z.string().trim().max(2000).optional(),
    /** null clears it. */
    nextFollowUpAt: z.coerce.date().nullable().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "nothing to change" });

export const editSevakBody = z
  .object({ name: sevakName.optional(), phone: sevakPhone.optional(), email: sevakEmail.optional() })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "nothing to change" });

export const deleteBody = z.object({ reason: z.string().trim().max(300).default("") }).default({ reason: "" });

export const assignBody = z.object({ userId: objectId.nullable() });

export const flagBody = z.object({
  reason: z.enum(PLEDGE_FLAGS),
  note: z.string().trim().max(500).default(""),
});

export const counterVisibilityBody = z.object({ hidden: z.boolean() });

const mandate = z.object({
  status: z.enum(MANDATE_STATUSES),
  bank: z.string().trim().max(100).default(""),
  reference: z.string().trim().max(100).default(""),
  debitDay: z.number().int().min(1).max(31).optional(),
  startMonth: z.string().regex(MONTH_RE, "must look like 2026-11").optional(),
});

export const paymentSetupBody = z
  .object({
    mode: z.enum(PAYMENT_MODES),
    mandate: mandate.optional(),
    note: z.string().trim().max(500).default(""),
  })
  .refine((b) => !AUTO_DEBIT_MODES.includes(b.mode) || b.mandate, {
    message: "say where the mandate stands",
    path: ["mandate"],
  })
  // Mandate details mean nothing for someone who pays by hand each month.
  .transform((b) => (AUTO_DEBIT_MODES.includes(b.mode) ? b : { ...b, mandate: undefined }));
