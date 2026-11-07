import type { Filter, ObjectId } from "mongodb";
import type { z } from "zod";
import type { PledgeDoc, PledgeFlagReason, PledgeStatus, SevakDoc } from "../../domain/types.js";
import { endOfIstDay } from "../../lib/dates.js";
import { badRequest, notFound } from "../../lib/errors.js";
import type { Actor } from "../../middleware/auth.js";
import * as audit from "../audit/audit.service.js";
import * as followupsRepo from "../followups/followups.repository.js";
import * as notifications from "../notifications/notifications.service.js";
import * as paymentsRepo from "../payments/payments.repository.js";
import * as sevaksRepo from "../sevaks/sevaks.repository.js";
import * as usersRepo from "../users/users.repository.js";
import * as repo from "./pledges.repository.js";
import { allowedNext, canTransition } from "./pledges.rules.js";
import type { listPledgesQuery } from "./pledges.schema.js";

/** Follow-up devotees only see pledges assigned to them; for everyone else the pledge "doesn't exist". */
export async function loadForActor(actor: Actor, id: ObjectId): Promise<PledgeDoc> {
  const pledge = await repo.findById(id);
  if (!pledge || (actor.role !== "admin" && !pledge.assignedTo?.equals(actor.id))) throw notFound("Pledge");
  return pledge;
}

async function withPeople(pledges: PledgeDoc[]) {
  const [sevaks, users] = await Promise.all([
    sevaksRepo.findByIds(pledges.map((p) => p.sevakId)),
    usersRepo.list(),
  ]);
  const names = new Map(users.map((u) => [u._id.toHexString(), u.name]));
  return pledges.map(({ source: _source, ...p }) => {
    const sevak = sevaks.get(p.sevakId.toHexString());
    return {
      ...p,
      sevak: sevak ? { _id: sevak._id, name: sevak.name, phone: sevak.phone, email: sevak.email } : null,
      assignee: p.assignedTo ? { _id: p.assignedTo, name: names.get(p.assignedTo.toHexString()) ?? "Unknown" } : null,
      flag: p.flag ? { ...p.flag, byName: names.get(p.flag.by.toHexString()) ?? "Unknown" } : null,
      hiddenFromCounter: p.hiddenFromCounter === true,
    };
  });
}

export async function list(actor: Actor, q: z.infer<typeof listPledgesQuery>) {
  const filter: Filter<PledgeDoc> = {};
  if (actor.role !== "admin") filter.assignedTo = actor.id;
  else if (q.assignedTo === "none") filter.assignedTo = { $exists: false };
  else if (q.assignedTo) filter.assignedTo = q.assignedTo;
  if (q.status) filter.status = q.status;
  filter.flag = { $exists: q.flagged === "true" };
  if (q.hidden === "true") filter.hiddenFromCounter = true;
  if (q.due === "true") filter.nextFollowUpAt = { $lte: endOfIstDay() };
  if (q.q) filter.sevakId = { $in: await sevaksRepo.searchIds(q.q) };

  const sort: Record<string, 1 | -1> =
    q.sort === "oldest" ? { createdAt: 1 } : q.sort === "nextFollowUp" ? { nextFollowUpAt: 1, createdAt: 1 } : { createdAt: -1 };
  const { items, total } = await repo.list(filter, { skip: (q.page - 1) * q.limit, limit: q.limit, sort });
  return { items: await withPeople(items), total, page: q.page, limit: q.limit };
}

export async function detail(actor: Actor, id: ObjectId) {
  const pledge = await loadForActor(actor, id);
  const [[enriched], followups, payments] = await Promise.all([
    withPeople([pledge]),
    followupsRepo.listForPledge(pledge._id),
    paymentsRepo.listForPledge(pledge._id),
  ]);
  return { ...enriched, source: pledge.source, allowedNextStatuses: allowedNext(pledge.status), followups, payments };
}

export async function updateStatus(actor: Actor, id: ObjectId, status: PledgeStatus, note?: string) {
  const pledge = await loadForActor(actor, id);
  if (pledge.status === status) return detail(actor, id);
  if (!canTransition(pledge.status, status)) {
    throw badRequest(`A ${pledge.status} pledge can't be marked ${status}.`, { allowed: allowedNext(pledge.status) });
  }
  // Closed pledges no longer need a follow-up.
  const closing = status === "lost" || status === "cancelled";
  await repo.update(id, { status }, closing ? ["nextFollowUpAt"] : []);
  await audit.record(actor.id, "pledge.status", "pledge", id, { from: pledge.status, to: status, note });
  return detail(actor, id);
}

export async function assign(actor: Actor, id: ObjectId, userId: ObjectId | null) {
  const pledge = await loadForActor(actor, id);
  if (userId) {
    const assignee = await usersRepo.findById(userId);
    if (!assignee || !assignee.active) throw badRequest("That staff account doesn't exist or is inactive.");
    if (pledge.assignedTo?.equals(userId)) return detail(actor, id);
    const updated = await repo.update(id, { assignedTo: userId });
    const sevak = await sevaksRepo.findById(pledge.sevakId);
    if (updated && sevak && !userId.equals(actor.id)) await notifications.pledgeAssigned(updated, sevak, userId);
  } else {
    await repo.update(id, {}, ["assignedTo"]);
  }
  await audit.record(actor.id, "pledge.assign", "pledge", id, { from: pledge.assignedTo ?? null, to: userId });
  return detail(actor, id);
}

/** Marks a pledge as not genuine. Anyone who can see the pledge may do this (devotees find fake numbers on calls). */
export async function flag(actor: Actor, id: ObjectId, reason: PledgeFlagReason, note: string) {
  const pledge = await loadForActor(actor, id);
  await repo.update(id, { flag: { reason, note, by: actor.id, at: new Date() } });
  await audit.record(actor.id, "pledge.flag", "pledge", id, { reason, note, previous: pledge.flag?.reason ?? null });
  return detail(actor, id);
}

export async function unflag(actor: Actor, id: ObjectId) {
  const pledge = await loadForActor(actor, id);
  if (!pledge.flag) return detail(actor, id);
  await repo.update(id, {}, ["flag"]);
  await audit.record(actor.id, "pledge.unflag", "pledge", id, { was: pledge.flag.reason });
  return detail(actor, id);
}

/** Admin only: keep a genuine pledge off the public counter (or put it back). */
export async function setCounterVisibility(actor: Actor, id: ObjectId, hidden: boolean) {
  const pledge = await loadForActor(actor, id);
  if ((pledge.hiddenFromCounter === true) !== hidden) {
    await repo.update(id, hidden ? { hiddenFromCounter: true } : {}, hidden ? [] : ["hiddenFromCounter"]);
    await audit.record(actor.id, hidden ? "pledge.counter_hide" : "pledge.counter_show", "pledge", id);
  }
  return detail(actor, id);
}

/** Used by the public form. */
export async function createFromSubmission(input: {
  name: string;
  phone: string;
  email: string;
  seva: string;
  amount: number;
  message: string;
  source: PledgeDoc["source"];
}): Promise<{ pledge: PledgeDoc; sevak: SevakDoc }> {
  const sevak = await sevaksRepo.upsertByPhone({ name: input.name, phone: input.phone, email: input.email });
  const pledge = await repo.insert({
    sevakId: sevak._id,
    seva: input.seva,
    amount: input.amount,
    frequency: "Monthly",
    status: "new",
    message: input.message,
    consent: true,
    source: input.source,
    nextFollowUpAt: new Date(),
  });
  await audit.record(null, "pledge.create", "pledge", pledge._id, { amount: pledge.amount, seva: pledge.seva });
  await notifications.pledgeCreated(pledge, sevak);
  return { pledge, sevak };
}
