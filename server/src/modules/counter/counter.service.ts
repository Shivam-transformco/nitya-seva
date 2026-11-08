import type { Filter, ObjectId } from "mongodb";
import type { z } from "zod";
import { collections } from "../../db/mongo.js";
import type { PledgeDoc } from "../../domain/types.js";
import { notFound } from "../../lib/errors.js";
import type { Actor } from "../../middleware/auth.js";
import * as audit from "../audit/audit.service.js";
import { MONTHLY_AMOUNT } from "../pledges/pledges.rules.js";
import * as repo from "./counter.repository.js";
import {
  adjustmentTotals,
  countedPledges,
  DEFAULT_TARGET,
  displayedTotals,
  flaggedPledges,
  hiddenPledges,
  type Totals,
} from "./counter.rules.js";
import type { createAdjustmentBody, updateAdjustmentBody } from "./counter.schema.js";

/** Sum of monthly amounts and distinct sevaks over the matching pledges. */
async function pledgeTotals(filter: Filter<PledgeDoc>): Promise<Totals & { pledges: number }> {
  const [agg] = await (await collections.pledges())
    .aggregate<Totals & { pledges: number }>([
      { $match: filter },
      { $group: { _id: null, amount: { $sum: MONTHLY_AMOUNT }, pledges: { $sum: 1 }, sevakIds: { $addToSet: "$sevakId" } } },
      { $project: { _id: 0, amount: 1, pledges: 1, sevaks: { $size: "$sevakIds" } } },
    ])
    .toArray();
  return agg ?? { amount: 0, sevaks: 0, pledges: 0 };
}

async function target(): Promise<number> {
  return (await repo.getSettings())?.target ?? DEFAULT_TARGET;
}

/** What the public site shows. */
export async function publicTotals(): Promise<Totals & { target: number }> {
  const [real, adjustments, goal] = await Promise.all([pledgeTotals(countedPledges), repo.listActive(), target()]);
  return { ...displayedTotals(real, adjustments), target: goal };
}

/** How the public number is made up, for the admin counter page. */
export async function breakdown() {
  const [counted, hidden, flagged, adjustments, settings] = await Promise.all([
    pledgeTotals(countedPledges),
    pledgeTotals(hiddenPledges),
    pledgeTotals(flaggedPledges),
    repo.list(),
    repo.getSettings(),
  ]);
  return {
    counted,
    hidden,
    flagged,
    adjustments: { ...adjustmentTotals(adjustments), items: adjustments },
    displayed: displayedTotals(counted, adjustments),
    target: settings?.target ?? DEFAULT_TARGET,
    targetUpdatedAt: settings?.updatedAt ?? null,
  };
}

export async function setTarget(actor: Actor, value: number) {
  const before = await target();
  const doc = await repo.saveTarget(value, actor.id);
  await audit.record(actor.id, "counter.target_update", "settings", null, { from: before, to: value });
  return { target: doc.target, targetUpdatedAt: doc.updatedAt };
}

export async function createAdjustment(actor: Actor, input: z.infer<typeof createAdjustmentBody>) {
  const doc = await repo.insert({ ...input, createdBy: actor.id });
  await audit.record(actor.id, "counter.adjustment_create", "counterAdjustment", doc._id, {
    label: doc.label,
    amount: doc.amount,
    sevaks: doc.sevaks,
    active: doc.active,
  });
  return doc;
}

export async function updateAdjustment(actor: Actor, id: ObjectId, input: z.infer<typeof updateAdjustmentBody>) {
  const before = await repo.findById(id);
  if (!before) throw notFound("Adjustment");
  const after = await repo.update(id, input);
  if (!after) throw notFound("Adjustment");
  await audit.record(actor.id, "counter.adjustment_update", "counterAdjustment", id, {
    from: { amount: before.amount, sevaks: before.sevaks, active: before.active },
    to: { amount: after.amount, sevaks: after.sevaks, active: after.active },
  });
  return after;
}

export async function removeAdjustment(actor: Actor, id: ObjectId) {
  const before = await repo.findById(id);
  if (!before || !(await repo.remove(id))) throw notFound("Adjustment");
  await audit.record(actor.id, "counter.adjustment_delete", "counterAdjustment", id, {
    label: before.label,
    amount: before.amount,
    sevaks: before.sevaks,
  });
}
