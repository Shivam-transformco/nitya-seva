import type { ObjectId } from "mongodb";
import type { z } from "zod";
import type { PledgeDoc } from "../../domain/types.js";
import type { Actor } from "../../middleware/auth.js";
import * as audit from "../audit/audit.service.js";
import * as pledgesRepo from "../pledges/pledges.repository.js";
import { statusAfterFollowup } from "../pledges/pledges.rules.js";
import { loadForActor } from "../pledges/pledges.service.js";
import * as repo from "./followups.repository.js";
import type { createFollowupBody } from "./followups.schema.js";

export async function list(actor: Actor, pledgeId: ObjectId) {
  await loadForActor(actor, pledgeId);
  return repo.listForPledge(pledgeId);
}

export async function create(actor: Actor, pledgeId: ObjectId, input: z.infer<typeof createFollowupBody>) {
  const pledge = await loadForActor(actor, pledgeId);
  const followup = await repo.insert({
    pledgeId,
    sevakId: pledge.sevakId,
    byUserId: actor.id,
    channel: input.channel,
    outcome: input.outcome,
    note: input.note,
    ...(input.nextFollowUpAt ? { nextFollowUpAt: input.nextFollowUpAt } : {}),
  });

  const nextStatus = statusAfterFollowup(pledge.status, input.outcome);
  const closed = nextStatus === "lost" || nextStatus === "cancelled";
  const set: Partial<PledgeDoc> = { lastContactAt: followup.createdAt };
  if (nextStatus) set.status = nextStatus;
  if (input.nextFollowUpAt && !closed) set.nextFollowUpAt = input.nextFollowUpAt;
  // Without a new date the pledge drops off the "due" list instead of nagging forever.
  const unset: (keyof PledgeDoc)[] = input.nextFollowUpAt && !closed ? [] : ["nextFollowUpAt"];
  const updated = await pledgesRepo.update(pledgeId, set, unset);

  await audit.record(actor.id, "followup.create", "pledge", pledgeId, {
    followupId: followup._id,
    outcome: input.outcome,
    ...(nextStatus ? { status: { from: pledge.status, to: nextStatus } } : {}),
  });
  return { followup, pledgeStatus: updated?.status ?? pledge.status };
}
