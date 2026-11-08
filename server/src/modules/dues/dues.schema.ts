import { z } from "zod";
import { DUE_REASONS } from "../../domain/types.js";
import { MONTH_RE } from "../../lib/dates.js";

export const month = z.string().regex(MONTH_RE, "must look like 2026-04");

export const dueNoteBody = z.object({
  reason: z.enum(DUE_REASONS),
  note: z.string().trim().max(500).default(""),
  /** Don't count the month as missed (they gave in person, the temple waived it, ...). */
  excused: z.boolean().default(false),
});
