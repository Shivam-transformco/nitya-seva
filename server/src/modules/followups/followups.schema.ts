import { z } from "zod";
import { FOLLOWUP_CHANNELS, FOLLOWUP_OUTCOMES } from "../../domain/types.js";

export const createFollowupBody = z
  .object({
    channel: z.enum(FOLLOWUP_CHANNELS),
    outcome: z.enum(FOLLOWUP_OUTCOMES),
    note: z.string().trim().max(2000).default(""),
    nextFollowUpAt: z.coerce.date().optional(),
  })
  .refine((b) => b.outcome !== "callback" || b.nextFollowUpAt, {
    message: "choose when to call back",
    path: ["nextFollowUpAt"],
  });
