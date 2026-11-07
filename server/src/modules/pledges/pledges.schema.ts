import { z } from "zod";
import { PLEDGE_FLAGS, PLEDGE_STATUSES } from "../../domain/types.js";
import { objectId, pagination } from "../../lib/http.js";

export const listPledgesQuery = pagination.extend({
  status: z.enum(PLEDGE_STATUSES).optional(),
  assignedTo: z.union([objectId, z.literal("none")]).optional(),
  /** Only pledges whose follow-up is due by the end of today (IST). */
  due: z.enum(["true", "false"]).optional(),
  /** Flagged (not genuine) pledges are left out unless asked for. */
  flagged: z.enum(["true", "false"]).default("false"),
  /** Only pledges hidden from the public counter. */
  hidden: z.enum(["true"]).optional(),
  q: z.string().trim().min(2).max(100).optional(),
  sort: z.enum(["newest", "oldest", "nextFollowUp"]).default("newest"),
});

export const updateStatusBody = z.object({
  status: z.enum(PLEDGE_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

export const assignBody = z.object({ userId: objectId.nullable() });

export const flagBody = z.object({
  reason: z.enum(PLEDGE_FLAGS),
  note: z.string().trim().max(500).default(""),
});

export const counterVisibilityBody = z.object({ hidden: z.boolean() });
