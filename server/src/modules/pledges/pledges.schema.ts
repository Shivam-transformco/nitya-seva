import { z } from "zod";
import {
  AUTO_DEBIT_MODES,
  FREQUENCIES,
  MANDATE_STATUSES,
  MANUAL_ORIGINS,
  PAYMENT_MODES,
  PLEDGE_FLAGS,
  PLEDGE_ORIGINS,
  PLEDGE_STATUSES,
} from "../../domain/types.js";
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
  origin: z.enum(PLEDGE_ORIGINS).optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  q: z.string().trim().min(2).max(100).optional(),
  /** Only pledges with a gift overdue or missed. */
  overdue: z.enum(["true"]).optional(),
  sort: z.enum(["newest", "oldest", "nextFollowUp"]).default("newest"),
});

const futureDate = z.coerce.date().refine((d) => d.getTime() > Date.now() - 86_400_000, "must be in the future");

export const updateStatusBody = z.object({
  status: z.enum(PLEDGE_STATUSES),
  note: z.string().trim().max(1000).optional(),
  /** Admins may set any status to put a mistake right, outside the usual lifecycle. */
  correction: z.boolean().default(false),
  /** With "paused": when they said they'd resume. */
  pausedUntil: futureDate.optional(),
});

/** 0 means they haven't decided yet (common for Google Form responses). */
const amount = z.number().int().min(0).max(10_00_000);
const seva = z.string().trim().min(1, "is required").max(100);
const month = z.string().regex(MONTH_RE, "must look like 2023-04");

export const editPledgeBody = z
  .object({
    amount: amount.optional(),
    frequency: z.enum(FREQUENCIES).optional(),
    seva: seva.optional(),
    message: z.string().trim().max(2000).optional(),
    origin: z.enum(PLEDGE_ORIGINS).optional(),
    /** null clears it. */
    givingSince: month.nullable().optional(),
    /** The first month a gift is due; earlier months are never counted as missed. null clears it. */
    dueFrom: month.nullable().optional(),
    /** Day of the month the gift is due; after it, an unpaid gift is overdue. null = the mandate's debit day, or month end. */
    dueDay: z.number().int().min(1).max(31).nullable().optional(),
    /** null clears it. */
    nextFollowUpAt: z.coerce.date().nullable().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "nothing to change" });

export const createPledgeBody = z.object({
  name: sevakName,
  phone: sevakPhone,
  email: sevakEmail.default(""),
  amount,
  frequency: z.enum(FREQUENCIES).default("Monthly"),
  seva,
  message: z.string().trim().max(2000).default(""),
  origin: z.enum(MANUAL_ORIGINS),
  status: z.enum(["new", "contacted", "confirmed", "paused"]).default("new"),
  givingSince: month.optional(),
  countOnCounter: z.boolean().default(true),
  assignedTo: objectId.optional(),
  nextFollowUpAt: z.coerce.date().optional(),
});

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
