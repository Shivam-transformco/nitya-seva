import type { Filter, ObjectId } from "mongodb";
import type { z } from "zod";
import { ASSIGNABLE_ROLES, can } from "../../domain/permissions.js";
import type { PaymentSetup, PledgeDoc, PledgeFlagReason, PledgeStatus, Schedule, SevakDoc, StatusChange } from "../../domain/types.js";
import { endOfIstDay, istMonth } from "../../lib/dates.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import type { Actor } from "../../middleware/auth.js";
import * as audit from "../audit/audit.service.js";
import * as dues from "../dues/dues.ledgers.js";
import * as followupsRepo from "../followups/followups.repository.js";
import * as notifications from "../notifications/notifications.service.js";
import * as paymentsRepo from "../payments/payments.repository.js";
import * as sevaksRepo from "../sevaks/sevaks.repository.js";
import * as usersRepo from "../users/users.repository.js";
import * as repo from "./pledges.repository.js";
import {
  allowedNext,
  canTransition,
  conflictsWithPayments,
  isClosed,
  monthlyEquivalent,
  originFilter,
  originOf,
  scheduleAfter,
  scheduleOf,
  scheduleUpdate,
  undoTarget,
} from "./pledges.rules.js";
import type { createPledgeBody, editPledgeBody, editSevakBody, listPledgesQuery, paymentSetupBody } from "./pledges.schema.js";

const isAssignee = (actor: Actor, pledge: PledgeDoc) => pledge.assignedTo?.equals(actor.id) === true;

/** Without `pledges.viewAll` staff only see pledges assigned to them; to them any other pledge "doesn't exist". */
export async function loadForActor(actor: Actor, id: ObjectId): Promise<PledgeDoc> {
  const pledge = await repo.findById(id);
  if (!pledge || (!can(actor.role, "pledges.viewAll") && !isAssignee(actor, pledge))) throw notFound("Pledge");
  return pledge;
}

/** Status, follow-ups, details and flags: `pledges.manage`, or the devotee it's assigned to. */
export async function loadToWork(actor: Actor, id: ObjectId): Promise<PledgeDoc> {
  const pledge = await loadForActor(actor, id);
  if (!can(actor.role, "pledges.manage") && !isAssignee(actor, pledge)) throw forbidden("You can see this pledge but not change it.");
  return pledge;
}

/** Payments and how the sevak pays: `payments.manage`, or the devotee it's assigned to. */
export async function loadForPayments(actor: Actor, id: ObjectId): Promise<PledgeDoc> {
  const pledge = await loadForActor(actor, id);
  if (!can(actor.role, "payments.manage") && !isAssignee(actor, pledge)) throw forbidden("You can't record payments for this pledge.");
  return pledge;
}

async function withPeople(pledges: PledgeDoc[]) {
  const [sevaks, users] = await Promise.all([
    sevaksRepo.findByIds(pledges.map((p) => p.sevakId)),
    usersRepo.list(),
  ]);
  const names = new Map(users.map((u) => [u._id.toHexString(), u.name]));
  const nameOf = (id: ObjectId) => names.get(id.toHexString()) ?? "Unknown";
  return pledges.map(({ source: _source, lastStatusChange: _change, ...p }) => {
    const sevak = sevaks.get(p.sevakId.toHexString());
    return {
      ...p,
      origin: originOf(p),
      monthly: p.monthly ?? p.amount,
      sevak: sevak ? { _id: sevak._id, name: sevak.name, phone: sevak.phone, email: sevak.email, otherPhones: sevak.otherPhones ?? [] } : null,
      assignee: p.assignedTo ? { _id: p.assignedTo, name: nameOf(p.assignedTo) } : null,
      flag: p.flag ? { ...p.flag, byName: nameOf(p.flag.by) } : null,
      hiddenFromCounter: p.hiddenFromCounter === true,
      paymentSetup: p.paymentSetup ? { ...p.paymentSetup, updatedByName: nameOf(p.paymentSetup.updatedBy) } : null,
      amountHistory: (p.amountHistory ?? []).map((h) => ({ ...h, byName: nameOf(h.by) })),
    };
  });
}

export async function list(actor: Actor, q: z.infer<typeof listPledgesQuery>) {
  const and: Filter<PledgeDoc>[] = [];
  const filter: Filter<PledgeDoc> = {};
  if (!can(actor.role, "pledges.viewAll")) filter.assignedTo = actor.id;
  else if (q.assignedTo === "none") filter.assignedTo = { $exists: false };
  else if (q.assignedTo) filter.assignedTo = q.assignedTo;
  if (q.status) filter.status = q.status;
  filter.flag = { $exists: q.flagged === "true" };
  if (q.hidden === "true") filter.hiddenFromCounter = true;
  if (q.mode === "none") filter.paymentSetup = { $exists: false };
  else if (q.mode) filter["paymentSetup.mode"] = q.mode;
  if (q.mandate) filter["paymentSetup.mandate.status"] = q.mandate;
  if (q.due === "true") filter.nextFollowUpAt = { $lte: endOfIstDay() };
  if (q.origin) and.push(originFilter(q.origin));
  if (q.frequency) filter.frequency = q.frequency;
  if (q.q) filter.sevakId = { $in: await sevaksRepo.searchIds(q.q) };
  if (and.length) filter.$and = and;
  if (q.overdue) filter._id = { $in: await dues.owingIds(filter) };

  const sort: Record<string, 1 | -1> =
    q.sort === "oldest" ? { createdAt: 1 } : q.sort === "nextFollowUp" ? { nextFollowUpAt: 1, createdAt: 1 } : { createdAt: -1 };
  const { items, total } = await repo.list(filter, { skip: (q.page - 1) * q.limit, limit: q.limit, sort });
  const [people, owing] = await Promise.all([withPeople(items), dues.owingFor(items)]);
  return {
    items: people.map((p) => ({ ...p, owing: owing.get(p._id.toHexString()) ?? null })),
    total,
    page: q.page,
    limit: q.limit,
  };
}

export async function detail(actor: Actor, id: ObjectId) {
  const pledge = await loadForActor(actor, id);
  const [[enriched], followups, payments, users, ledger] = await Promise.all([
    withPeople([pledge]),
    followupsRepo.listForPledge(pledge._id),
    paymentsRepo.listForPledge(pledge._id),
    pledge.lastStatusChange ? usersRepo.list() : Promise.resolve([]),
    pledge.flag ? Promise.resolve(null) : dues.forPledge(pledge),
  ]);
  const change = pledge.lastStatusChange;
  const assigned = isAssignee(actor, pledge);
  return {
    ...enriched,
    source: pledge.source,
    allowedNextStatuses: allowedNext(pledge.status),
    lastStatusChange: change
      ? { ...change, byName: users.find((u) => u._id.equals(change.by))?.name ?? "Unknown" }
      : null,
    undoTo: undoTarget(pledge),
    /** What the signed-in staff member may do here, so the portal only shows what will work. */
    access: {
      work: assigned || can(actor.role, "pledges.manage"),
      payments: assigned || can(actor.role, "payments.manage"),
      manage: can(actor.role, "pledges.manage"),
    },
    followups,
    payments,
    /** What was due each month and what came; null when nothing is due (not confirmed yet, or not genuine). */
    dues: ledger,
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
  schedule: scheduleOf(pledge),
});

/** Adds the schedule change for a move to `to` this month into a pledge update. */
export function withSchedule(pledge: PledgeDoc, to: PledgeStatus, set: Partial<PledgeDoc>, unset: (keyof PledgeDoc)[], schedule?: Schedule) {
  const s = scheduleUpdate(schedule ?? scheduleAfter(pledge, to, istMonth()));
  Object.assign(set, s.set);
  unset.push(...s.unset.filter((k) => !unset.includes(k)));
}

export async function updateStatus(
  actor: Actor,
  id: ObjectId,
  input: { status: PledgeStatus; note?: string; correction?: boolean; pausedUntil?: Date },
) {
  const { status, note, correction = false, pausedUntil } = input;
  if (correction && !can(actor.role, "pledges.manage")) throw forbidden("Only admins can correct a status directly.");
  const pledge = await loadToWork(actor, id);
  if (pledge.status === status && !(status === "paused" && pausedUntil)) return detail(actor, id);
  if (pledge.status !== status && !correction && !canTransition(pledge.status, status)) {
    throw badRequest(`A ${pledge.status} pledge can't be marked ${status}.`, { allowed: allowedNext(pledge.status) });
  }
  await assertPaymentsAllow(pledge, status);

  const set: Partial<PledgeDoc> = { status };
  const unset: (keyof PledgeDoc)[] = [];
  if (pledge.status !== status) {
    set.lastStatusChange = statusChange(pledge, status, actor.id);
    withSchedule(pledge, status, set, unset);
  }
  if (isClosed(status)) unset.push("nextFollowUpAt");
  if (status === "paused" && pausedUntil) {
    // The pause ending brings the pledge back onto its devotee's due list.
    set.pausedUntil = pausedUntil;
    set.nextFollowUpAt = pausedUntil;
  } else if (status !== "paused") unset.push("pausedUntil");
  await repo.update(id, set, unset);
  await audit.record(actor.id, correction ? "pledge.status_correct" : "pledge.status", "pledge", id, {
    from: pledge.status,
    to: status,
    note,
    ...(pausedUntil ? { pausedUntil } : {}),
  });
  return detail(actor, id);
}

/** Puts back the status from before the most recent change (a misclick, or a follow-up logged with the wrong outcome). */
export async function undoStatus(actor: Actor, id: ObjectId) {
  const pledge = await loadToWork(actor, id);
  const target = undoTarget(pledge);
  if (!target) throw badRequest("There's no status change to undo. The status may have changed again since.");
  await assertPaymentsAllow(pledge, target);
  const set: Partial<PledgeDoc> = { status: target };
  const unset: (keyof PledgeDoc)[] = ["lastStatusChange"];
  if (target !== "paused") unset.push("pausedUntil");
  withSchedule(pledge, target, set, unset, pledge.lastStatusChange?.schedule);
  const previousFollowUp = pledge.lastStatusChange?.nextFollowUpAt;
  if (isClosed(target)) unset.push("nextFollowUpAt");
  else if (previousFollowUp && !pledge.nextFollowUpAt) set.nextFollowUpAt = previousFollowUp;
  await repo.update(id, set, unset);
  await audit.record(actor.id, "pledge.status_undo", "pledge", id, { from: pledge.status, to: target });
  return detail(actor, id);
}

export async function edit(actor: Actor, id: ObjectId, input: z.infer<typeof editPledgeBody>) {
  const pledge = await loadToWork(actor, id);
  if (input.origin !== undefined && input.origin !== originOf(pledge) && !can(actor.role, "pledges.manage")) {
    throw forbidden("Only admins can change where a pledge came from.");
  }
  const set: Partial<PledgeDoc> = {};
  const unset: (keyof PledgeDoc)[] = [];
  const amount = input.amount ?? pledge.amount;
  const frequency = input.frequency ?? pledge.frequency;
  if (amount !== pledge.amount || frequency !== pledge.frequency) {
    Object.assign(set, { amount, frequency, monthly: monthlyEquivalent(amount, frequency) });
    set.amountHistory = [
      ...(pledge.amountHistory ?? []),
      { amount: pledge.amount, frequency: pledge.frequency, until: new Date(), by: actor.id },
    ];
  }
  if (input.seva !== undefined) set.seva = input.seva;
  if (input.message !== undefined) set.message = input.message;
  if (input.origin !== undefined) set.origin = input.origin;
  if (input.givingSince === null) unset.push("givingSince");
  else if (input.givingSince) set.givingSince = input.givingSince;
  if (input.dueFrom === null) unset.push("dueFrom");
  else if (input.dueFrom) set.dueFrom = input.dueFrom;
  if (input.dueDay === null) unset.push("dueDay");
  else if (input.dueDay) set.dueDay = input.dueDay;
  if (input.nextFollowUpAt === null) unset.push("nextFollowUpAt");
  else if (input.nextFollowUpAt) {
    if (isClosed(pledge.status)) throw badRequest(`A ${pledge.status} pledge doesn't need a follow-up.`);
    set.nextFollowUpAt = input.nextFollowUpAt;
  }
  if (!Object.keys(set).length && !unset.length) return detail(actor, id);
  await repo.update(id, set, unset);
  const changed = [...Object.keys(set), ...unset].filter((k) => k !== "amountHistory" && k !== "monthly") as (keyof PledgeDoc)[];
  await audit.record(actor.id, "pledge.edit", "pledge", id, {
    from: Object.fromEntries(changed.map((k) => [k, pledge[k] ?? null])),
    to: Object.fromEntries(changed.map((k) => [k, set[k] ?? null])),
  });
  return detail(actor, id);
}

/** Name, phone and email belong to the sevak, so the change shows on all of their pledges. */
export async function editSevak(actor: Actor, id: ObjectId, input: z.infer<typeof editSevakBody>) {
  const pledge = await loadToWork(actor, id);
  const sevak = await sevaksRepo.findById(pledge.sevakId);
  if (!sevak) throw notFound("Sevak");
  if (input.phone && input.phone !== sevak.phone) {
    const other = await sevaksRepo.findByPhone(input.phone);
    if (other && !other._id.equals(sevak._id)) {
      throw conflict(`${input.phone} already belongs to ${other.name}. If they're the same person, merge the two sevaks instead.`);
    }
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

async function assertAssignable(userId: ObjectId) {
  const assignee = await usersRepo.findById(userId);
  if (!assignee || !assignee.active) throw badRequest("That staff account doesn't exist or is inactive.");
  if (!ASSIGNABLE_ROLES.includes(assignee.role)) throw badRequest(`${assignee.name} can't be given pledges to follow up.`);
}

export async function assign(actor: Actor, id: ObjectId, userId: ObjectId | null) {
  const pledge = await loadToWork(actor, id);
  if (userId) {
    await assertAssignable(userId);
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

/** Marks a pledge as not genuine. The assigned devotee may do this too (they find fake numbers on calls). */
export async function flag(actor: Actor, id: ObjectId, reason: PledgeFlagReason, note: string) {
  const pledge = await loadToWork(actor, id);
  await repo.update(id, { flag: { reason, note, by: actor.id, at: new Date() } });
  await audit.record(actor.id, "pledge.flag", "pledge", id, { reason, note, previous: pledge.flag?.reason ?? null });
  return detail(actor, id);
}

export async function unflag(actor: Actor, id: ObjectId) {
  const pledge = await loadToWork(actor, id);
  if (!pledge.flag) return detail(actor, id);
  await repo.update(id, {}, ["flag"]);
  await audit.record(actor.id, "pledge.unflag", "pledge", id, { was: pledge.flag.reason });
  return detail(actor, id);
}

/** Keep a genuine pledge off the public counter (or put it back). */
export async function setCounterVisibility(actor: Actor, id: ObjectId, hidden: boolean) {
  const pledge = await loadToWork(actor, id);
  if ((pledge.hiddenFromCounter === true) !== hidden) {
    await repo.update(id, hidden ? { hiddenFromCounter: true } : {}, hidden ? [] : ["hiddenFromCounter"]);
    await audit.record(actor.id, hidden ? "pledge.counter_hide" : "pledge.counter_show", "pledge", id);
  }
  return detail(actor, id);
}

/** Records how the sevak pays (devotees often help fill the ECS form; accounts keep mandates up to date). */
export async function setPaymentSetup(actor: Actor, id: ObjectId, input: z.infer<typeof paymentSetupBody>) {
  const pledge = await loadForPayments(actor, id);
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
  const pledge = await loadForPayments(actor, id);
  if (!pledge.paymentSetup) return detail(actor, id);
  await repo.update(id, {}, ["paymentSetup"]);
  await audit.record(actor.id, "pledge.payment_setup_clear", "pledge", id, { was: pledge.paymentSetup.mode });
  return detail(actor, id);
}

/**
 * Staff adding a pledge by hand: sevaks from before the website, Google Form responses, walk-ins.
 * A phone number we already know adds the pledge to that sevak rather than creating a second one.
 */
export async function create(actor: Actor, input: z.infer<typeof createPledgeBody>) {
  if (input.assignedTo) await assertAssignable(input.assignedTo);
  const existing = await sevaksRepo.findByPhone(input.phone);
  const sevak = existing ?? (await sevaksRepo.insert({ name: input.name, phone: input.phone, email: input.email }));
  if (existing && input.email && !existing.email) await sevaksRepo.update(existing._id, { email: input.email });

  // New leads go straight onto the due list; others only if staff chose a date.
  const nextFollowUpAt = isClosed(input.status) ? undefined : (input.nextFollowUpAt ?? (input.status === "new" ? new Date() : undefined));
  const pledge = await repo.insert({
    sevakId: sevak._id,
    seva: input.seva,
    amount: input.amount,
    frequency: input.frequency,
    monthly: monthlyEquivalent(input.amount, input.frequency),
    origin: input.origin,
    ...(input.givingSince ? { givingSince: input.givingSince } : {}),
    ...scheduleAfter({ givingSince: input.givingSince }, input.status, istMonth()),
    status: input.status,
    message: input.message,
    consent: true,
    source: { submittedFrom: "portal", addedBy: actor.id },
    ...(input.assignedTo ? { assignedTo: input.assignedTo } : {}),
    ...(input.countOnCounter ? {} : { hiddenFromCounter: true }),
    ...(nextFollowUpAt ? { nextFollowUpAt } : {}),
  });
  await audit.record(actor.id, "pledge.create", "pledge", pledge._id, {
    origin: pledge.origin,
    amount: pledge.amount,
    frequency: pledge.frequency,
    status: pledge.status,
    existingSevak: Boolean(existing),
  });
  if (input.assignedTo && !input.assignedTo.equals(actor.id)) await notifications.pledgeAssigned(pledge, sevak, input.assignedTo);
  return { pledgeId: pledge._id, existingSevak: existing ? { name: existing.name } : null };
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
    monthly: input.amount,
    origin: "website",
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
