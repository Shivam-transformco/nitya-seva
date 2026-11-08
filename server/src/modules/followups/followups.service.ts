import type { ObjectId } from "mongodb";
import type { z } from "zod";
import { can } from "../../domain/permissions.js";
import type { PledgeDoc } from "../../domain/types.js";
import { forbidden, notFound } from "../../lib/errors.js";
import type { Actor } from "../../middleware/auth.js";
import * as audit from "../audit/audit.service.js";
import * as bin from "../bin/bin.repository.js";
import * as paymentsRepo from "../payments/payments.repository.js";
import * as pledgesRepo from "../pledges/pledges.repository.js";
import { conflictsWithPayments, isClosed, statusAfterFollowup } from "../pledges/pledges.rules.js";
import { loadForActor, loadToWork } from "../pledges/pledges.service.js";
import * as repo from "./followups.repository.js";
import type { createFollowupBody } from "./followups.schema.js";

export async function list(actor: Actor, pledgeId: ObjectId) {
  await loadForActor(actor, pledgeId);
  return repo.listForPledge(pledgeId);
}

export async function create(actor: Actor, pledgeId: ObjectId, input: z.infer<typeof createFollowupBody>) {
  const pledge = await loadToWork(actor, pledgeId);
  const followup = await repo.insert({
    pledgeId,
    sevakId: pledge.sevakId,
    byUserId: actor.id,
    channel: input.channel,
    outcome: input.outcome,
    note: input.note,
    ...(input.nextFollowUpAt ? { nextFollowUpAt: input.nextFollowUpAt } : {}),
    before: {
      ...(pledge.lastContactAt ? { lastContactAt: pledge.lastContactAt } : {}),
      ...(pledge.nextFollowUpAt ? { nextFollowUpAt: pledge.nextFollowUpAt } : {}),
    },
  });

  const nextStatus = statusAfterFollowup(pledge.status, input.outcome);
  const closed = nextStatus !== null && isClosed(nextStatus);
  const set: Partial<PledgeDoc> = { lastContactAt: followup.createdAt };
  if (nextStatus) {
    set.status = nextStatus;
    set.lastStatusChange = {
      from: pledge.status,
      to: nextStatus,
      by: actor.id,
      at: followup.createdAt,
      followupId: followup._id,
      ...(pledge.nextFollowUpAt ? { nextFollowUpAt: pledge.nextFollowUpAt } : {}),
    };
  }
  if (input.nextFollowUpAt && !closed) set.nextFollowUpAt = input.nextFollowUpAt;
  // Without a new date the pledge drops off the "due" list instead of nagging forever.
  const unset: (keyof PledgeDoc)[] = input.nextFollowUpAt && !closed ? [] : ["nextFollowUpAt"];
  if (nextStatus && nextStatus !== "paused") unset.push("pausedUntil");
  const updated = await pledgesRepo.update(pledgeId, set, unset);

  await audit.record(actor.id, "followup.create", "pledge", pledgeId, {
    followupId: followup._id,
    outcome: input.outcome,
    ...(nextStatus ? { status: { from: pledge.status, to: nextStatus } } : {}),
  });
  return { followup, pledgeStatus: updated?.status ?? pledge.status };
}

/**
 * Moves a follow-up to the bin. If it was the latest one, the pledge's contact dates go back to how they
 * were before it was logged, and a status change it caused is undone (unless payments rule that out).
 */
export async function remove(actor: Actor, pledgeId: ObjectId, followupId: ObjectId, reason: string) {
  const pledge = await loadForActor(actor, pledgeId);
  const followup = await repo.findById(followupId);
  if (!followup || !followup.pledgeId.equals(pledgeId)) throw notFound("Follow-up");
  if (!can(actor.role, "pledges.manage") && !followup.byUserId.equals(actor.id)) {
    throw forbidden("Only the person who logged this follow-up, or an admin, can delete it.");
  }

  await bin.put({ kind: "followup", itemId: followup._id, pledgeId, sevakId: pledge.sevakId, reason, followups: [followup], payments: [], deletedBy: actor.id });
  await repo.removeByIds([followup._id]);

  const set: Partial<PledgeDoc> = {};
  const unset: (keyof PledgeDoc)[] = [];
  const latest = await repo.latestForPledge(pledgeId);
  if (!latest || latest.createdAt <= followup.createdAt) {
    const before = followup.before;
    const lastContactAt = before ? before.lastContactAt : latest?.createdAt;
    if (lastContactAt) set.lastContactAt = lastContactAt;
    else unset.push("lastContactAt");
    if (before) {
      if (before.nextFollowUpAt) set.nextFollowUpAt = before.nextFollowUpAt;
      else unset.push("nextFollowUpAt");
    }
  }

  const change = pledge.lastStatusChange;
  let statusReverted = false;
  if (change?.followupId?.equals(followup._id) && pledge.status === change.to) {
    if (!conflictsWithPayments(change.from, await paymentsRepo.countForPledge(pledgeId))) {
      set.status = change.from;
      unset.push("lastStatusChange");
      statusReverted = true;
      if (isClosed(change.from)) {
        delete set.nextFollowUpAt;
        if (!unset.includes("nextFollowUpAt")) unset.push("nextFollowUpAt");
      }
    }
  }
  if (Object.keys(set).length || unset.length) await pledgesRepo.update(pledgeId, set, unset);

  await audit.record(actor.id, "followup.delete", "pledge", pledgeId, {
    followupId: followup._id,
    outcome: followup.outcome,
    reason,
    ...(statusReverted && change ? { status: { from: change.to, to: change.from } } : {}),
  });
}
