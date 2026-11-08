import type { Filter, ObjectId } from "mongodb";
import type { z } from "zod";
import type { PaymentSetup, PledgeDoc, PledgeFlagReason, PledgeStatus, SevakDoc, StatusChange } from "../../domain/types.js";
import { endOfIstDay } from "../../lib/dates.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import type { Actor } from "../../middleware/auth.js";
import * as audit from "../audit/audit.service.js";
import * as followupsRepo from "../followups/followups.repository.js";
import * as notifications from "../notifications/notifications.service.js";
import * as paymentsRepo from "../payments/payments.repository.js";
import * as sevaksRepo from "../sevaks/sevaks.repository.js";
import * as usersRepo from "../users/users.repository.js";
import * as repo from "./pledges.repository.js";
import { allowedNext, canTransition, conflictsWithPayments, isClosed, undoTarget } from "./pledges.rules.js";
import type { editPledgeBody, editSevakBody, listPledgesQuery, paymentSetupBody } from "./pledges.schema.js";

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
  return pledges.map(({ source: _source, lastStatusChange: _change, ...p }) => {
    const sevak = sevaks.get(p.sevakId.toHexString());
    return {
      ...p,
      sevak: sevak ? { _id: sevak._id, name: sevak.name, phone: sevak.phone, email: sevak.email } : null,
      assignee: p.assignedTo ? { _id: p.assignedTo, name: names.get(p.assignedTo.toHexString()) ?? "Unknown" } : null,
      flag: p.flag ? { ...p.flag, byName: names.get(p.flag.by.toHexString()) ?? "Unknown" } : null,
      hiddenFromCounter: p.hiddenFromCounter === true,
      paymentSetup: p.paymentSetup
        ? { ...p.paymentSetup, updatedByName: names.get(p.paymentSetup.updatedBy.toHexString()) ?? "Unknown" }
        : null,
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
  if (q.mode === "none") filter.paymentSetup = { $exists: false };
  else if (q.mode) filter["paymentSetup.mode"] = q.mode;
  if (q.mandate) filter["paymentSetup.mandate.status"] = q.mandate;
  if (q.due === "true") filter.nextFollowUpAt = { $lte: endOfIstDay() };
  if (q.q) filter.sevakId = { $in: await sevaksRepo.searchIds(q.q) };

  const sort: Record<string, 1 | -1> =
    q.sort === "oldest" ? { createdAt: 1 } : q.sort === "nextFollowUp" ? { nextFollowUpAt: 1, createdAt: 1 } : { createdAt: -1 };
  const { items, total } = await repo.list(filter, { skip: (q.page - 1) * q.limit, limit: q.limit, sort });
  return { items: await withPeople(items), total, page: q.page, limit: q.limit };
}

export async function detail(actor: Actor, id: ObjectId) {
  const pledge = await loadForActor(actor, id);
  const [[enriched], followups, payments, users] = await Promise.all([
    withPeople([pledge]),
    followupsRepo.listForPledge(pledge._id),
    paymentsRepo.listForPledge(pledge._id),
    pledge.lastStatusChange ? usersRepo.list() : Promise.resolve([]),
  ]);
  const change = pledge.lastStatusChange;
  return {
    ...enriched,
    source: pledge.source,
    allowedNextStatuses: allowedNext(pledge.status),
    lastStatusChange: change
      ? { ...change, byName: users.find((u) => u._id.equals(change.by))?.name ?? "Unknown" }
      : null,
    undoTo: undoTarget(pledge),
    followups,
    payments,
  };
}

async function assertPaymentsAllow(pledge: PledgeDoc, status: PledgeStatus) {
  if (conflictsWithPayments(status, await paymentsRepo.countForPledge(pledge._id))) {
    throw badRequest(`This pledge has payments recorded, so it can't be ${status}. Delete the payments first if they were a mistake.`);
  }
}

/** Snapshot that lets the change be undone. */
const statusChange = (pledge: PledgeDoc, to: PledgeStatus, by: ObjectId, followupId?: ObjectId): StatusChange => ({
  from: pledge.status,
  to,
  by,
  at: new Date(),
  ...(followupId ? { followupId } : {}),
  ...(pledge.nextFollowUpAt ? { nextFollowUpAt: pledge.nextFollowUpAt } : {}),
});

export async function updateStatus(actor: Actor, id: ObjectId, status: PledgeStatus, note?: string, correction = false) {
  if (correction && actor.role !== "admin") throw forbidden("Only admins can correct a status directly.");
  const pledge = await loadForActor(actor, id);
  if (pledge.status === status) return detail(actor, id);
  if (!correction && !canTransition(pledge.status, status)) {
    throw badRequest(`A ${pledge.status} pledge can't be marked ${status}.`, { allowed: allowedNext(pledge.status) });
  }
  await assertPaymentsAllow(pledge, status);
  await repo.update(id, { status, lastStatusChange: statusChange(pledge, status, actor.id) }, isClosed(status) ? ["nextFollowUpAt"] : []);
  await audit.record(actor.id, correction ? "pledge.status_correct" : "pledge.status", "pledge", id, { from: pledge.status, to: status, note });
  return detail(actor, id);
}

/** Puts back the status from before the most recent change (a misclick, or a follow-up logged with the wrong outcome). */
export async function undoStatus(actor: Actor, id: ObjectId) {
  const pledge = await loadForActor(actor, id);
  const target = undoTarget(pledge);
  if (!target) throw badRequest("There's no status change to undo. The status may have changed again since.");
  await assertPaymentsAllow(pledge, target);
  const set: Partial<PledgeDoc> = { status: target };
  const unset: (keyof PledgeDoc)[] = ["lastStatusChange"];
  const previousFollowUp = pledge.lastStatusChange?.nextFollowUpAt;
  if (isClosed(target)) unset.push("nextFollowUpAt");
  else if (previousFollowUp && !pledge.nextFollowUpAt) set.nextFollowUpAt = previousFollowUp;
  await repo.update(id, set, unset);
  await audit.record(actor.id, "pledge.status_undo", "pledge", id, { from: pledge.status, to: target });
  return detail(actor, id);
}

export async function edit(actor: Actor, id: ObjectId, input: z.infer<typeof editPledgeBody>) {
  const pledge = await loadForActor(actor, id);
  const set: Partial<PledgeDoc> = {};
  const unset: (keyof PledgeDoc)[] = [];
  if (input.amount !== undefined) set.amount = input.amount;
  if (input.seva !== undefined) set.seva = input.seva;
  if (input.message !== undefined) set.message = input.message;
  if (input.nextFollowUpAt === null) unset.push("nextFollowUpAt");
  else if (input.nextFollowUpAt) {
    if (isClosed(pledge.status)) throw badRequest(`A ${pledge.status} pledge doesn't need a follow-up.`);
    set.nextFollowUpAt = input.nextFollowUpAt;
  }
  await repo.update(id, set, unset);
  const changed = [...Object.keys(set), ...unset] as (keyof PledgeDoc)[];
  await audit.record(actor.id, "pledge.edit", "pledge", id, {
    from: Object.fromEntries(changed.map((k) => [k, pledge[k] ?? null])),
    to: Object.fromEntries(changed.map((k) => [k, set[k] ?? null])),
  });
  return detail(actor, id);
}

/** Name, phone and email belong to the sevak, so the change shows on all of their pledges. */
export async function editSevak(actor: Actor, id: ObjectId, input: z.infer<typeof editSevakBody>) {
  const pledge = await loadForActor(actor, id);
  const sevak = await sevaksRepo.findById(pledge.sevakId);
  if (!sevak) throw notFound("Sevak");
  if (input.phone && input.phone !== sevak.phone) {
    const other = await sevaksRepo.findByPhone(input.phone);
    if (other) throw conflict(`${input.phone} already belongs to ${other.name}. If they're the same person, mark one pledge as a duplicate.`);
  }
  const set = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<SevakDoc>;
  await sevaksRepo.update(sevak._id, set);
  await audit.record(actor.id, "sevak.edit", "sevak", sevak._id, {
    pledgeId: id,
    from: Object.fromEntries(Object.keys(set).map((k) => [k, sevak[k as keyof SevakDoc]])),
    to: set,
  });
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

/** Records how the sevak pays. Anyone who can see the pledge may do this (devotees often help fill the ECS form). */
export async function setPaymentSetup(actor: Actor, id: ObjectId, input: z.infer<typeof paymentSetupBody>) {
  const pledge = await loadForActor(actor, id);
  const setup: PaymentSetup = {
    mode: input.mode,
    ...(input.mandate ? { mandate: input.mandate } : {}),
    note: input.note,
    updatedBy: actor.id,
    updatedAt: new Date(),
  };
  await repo.update(id, { paymentSetup: setup });
  await audit.record(actor.id, "pledge.payment_setup", "pledge", id, {
    from: pledge.paymentSetup ? { mode: pledge.paymentSetup.mode, mandate: pledge.paymentSetup.mandate?.status ?? null } : null,
    to: { mode: setup.mode, mandate: setup.mandate?.status ?? null },
  });
  return detail(actor, id);
}

export async function clearPaymentSetup(actor: Actor, id: ObjectId) {
  const pledge = await loadForActor(actor, id);
  if (!pledge.paymentSetup) return detail(actor, id);
  await repo.update(id, {}, ["paymentSetup"]);
  await audit.record(actor.id, "pledge.payment_setup_clear", "pledge", id, { was: pledge.paymentSetup.mode });
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
