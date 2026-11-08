import type { Filter, ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";
import { can } from "../../domain/permissions.js";
import type { DueReason, PledgeDoc } from "../../domain/types.js";
import { addMonths, istToday } from "../../lib/dates.js";
import { badRequest } from "../../lib/errors.js";
import type { Actor } from "../../middleware/auth.js";
import * as audit from "../audit/audit.service.js";
import { loadForPayments } from "../pledges/pledges.service.js";
import * as sevaksRepo from "../sevaks/sevaks.repository.js";
import { loadLedgers, lookback, userNames, withNoteName, type PledgeLedger } from "./dues.ledgers.js";
import * as repo from "./dues.repository.js";
import { missedInRow, MONTH_STATES, OWING, owedIn, totalsFor, type LedgerMonth, type MonthState } from "./dues.rules.js";

const visibleTo = (actor: Actor): Filter<PledgeDoc> => (can(actor.role, "pledges.viewAll") ? {} : { assignedTo: actor.id });
const canNote = (actor: Actor, p: PledgeDoc) => can(actor.role, "payments.manage") || p.assignedTo?.equals(actor.id) === true;

function monthsFrom(from: string, to: string) {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

/** Committed against collected for each month, for everyone with reports (totals only, no names). */
export async function monthly(from: string, to: string) {
  const today = istToday();
  const [ledgers, received] = await Promise.all([
    loadLedgers({}, { from, to }, today),
    (await collections.payments())
      .aggregate<{ _id: string; amount: number }>([
        { $match: { month: { $gte: from, $lte: to } } },
        { $group: { _id: "$month", amount: { $sum: "$amount" } } },
      ])
      .toArray(),
  ]);
  const receivedIn = new Map(received.map((r) => [r._id, r.amount]));
  const byMonth = new Map<string, LedgerMonth[]>();
  for (const l of ledgers) for (const m of l.months) byMonth.set(m.month, [...(byMonth.get(m.month) ?? []), m]);
  return {
    from,
    to,
    months: monthsFrom(from, to > today.month ? today.month : to).map((month) => ({
      ...totalsFor(month, byMonth.get(month) ?? []),
      /** Everything recorded for the month, including one-off extras and gifts above the pledge. */
      received: receivedIn.get(month) ?? 0,
    })),
  };
}

/** This month so far: what's expected, what has come, what is still to come by its due day, and what is late. */
export async function thisMonth() {
  const today = istToday();
  const rows = (await loadLedgers({}, { from: today.month, to: today.month }, today)).flatMap((l) => l.months);
  const t = totalsFor(today.month, rows);
  const gap = (states: MonthState[]) => rows.filter((r) => states.includes(r.state)).reduce((s, r) => s + Math.max(0, r.expected - r.paid), 0);
  return {
    month: today.month,
    expected: t.committed,
    received: t.collected,
    stillToCome: gap(["due"]),
    overdue: gap(["overdue", "partial"]),
    excused: t.excused,
    sevaks: t.sevaks,
  };
}

async function describer(ledgers: PledgeLedger[]) {
  const [sevaks, nameOf] = await Promise.all([sevaksRepo.findByIds(ledgers.map((l) => l.pledge.sevakId)), userNames()]);
  const describe = ({ pledge: p }: PledgeLedger) => {
    const s = sevaks.get(p.sevakId.toHexString());
    return {
      pledgeId: p._id,
      sevak: s ? { _id: s._id, name: s.name, phone: s.phone } : null,
      seva: p.seva,
      amount: p.amount,
      frequency: p.frequency,
      status: p.status,
      mode: p.paymentSetup?.mode ?? null,
      mandate: p.paymentSetup?.mandate?.status ?? null,
      assignee: p.assignedTo ? { _id: p.assignedTo, name: nameOf(p.assignedTo) } : null,
    };
  };
  return { describe, nameOf };
}

/** Every pledge with a gift due in the month, with what came and why not; the ones still owing first. */
export async function month(actor: Actor, m: string) {
  const today = istToday();
  if (m > today.month) throw badRequest("That month hasn't started yet.");
  const ledgers = (await loadLedgers(visibleTo(actor), { from: m, to: m }, today)).filter((l) => l.months.length);
  const { describe, nameOf } = await describer(ledgers);
  const rank = (s: MonthState) => (OWING.includes(s) ? 0 : s === "due" ? 1 : 2 + MONTH_STATES.indexOf(s));
  const rows = ledgers
    .map((l) => ({ ...describe(l), ...withNoteName(l.months[0]!, nameOf), canNote: canNote(actor, l.pledge) }))
    .sort((a, b) => rank(a.state) - rank(b.state) || b.expected - b.paid - (a.expected - a.paid));
  return { month: m, totals: totalsFor(m, ledgers.map((l) => l.months[0]!)), rows };
}

/** Sevaks who committed and haven't paid: overdue this month or missed in the last year, longest run first. */
export async function overdue(actor: Actor) {
  const today = istToday();
  const ledgers = (await loadLedgers(visibleTo(actor), lookback(today), today)).filter((l) => missedInRow(l.months) > 0);
  const { describe, nameOf } = await describer(ledgers);
  return ledgers
    .map((l) => {
      const latest = [...l.months].reverse().find((m) => m.note);
      return {
        ...describe(l),
        missedInRow: missedInRow(l.months),
        owed: owedIn(l.months),
        months: l.months.filter((m) => OWING.includes(m.state)).map(({ month, state, expected, paid }) => ({ month, state, expected, paid })),
        lastPaidMonth: l.lastPaidMonth,
        latestNote: latest?.note ? { month: latest.month, ...latest.note, byName: nameOf(latest.note.by) } : null,
        canNote: canNote(actor, l.pledge),
      };
    })
    .sort((a, b) => b.missedInRow - a.missedInRow || b.owed - a.owed);
}

/** Why a month's gift didn't come (or came short). `excused` stops it counting as missed. */
export async function setNote(actor: Actor, pledgeId: ObjectId, m: string, input: { reason: DueReason; note: string; excused: boolean }) {
  const pledge = await loadForPayments(actor, pledgeId);
  if (m > istToday().month) throw badRequest("You can only give a reason for this month or earlier.");
  const previous = await repo.find(pledgeId, m);
  await repo.put({ pledgeId, sevakId: pledge.sevakId, month: m, ...input, by: actor.id, at: new Date() });
  await audit.record(actor.id, "pledge.due_note", "pledge", pledgeId, {
    month: m,
    ...input,
    previous: previous ? { reason: previous.reason, note: previous.note, excused: previous.excused } : null,
  });
}

export async function removeNote(actor: Actor, pledgeId: ObjectId, m: string) {
  await loadForPayments(actor, pledgeId);
  const previous = await repo.find(pledgeId, m);
  if (!previous) return;
  await repo.remove(pledgeId, m);
  await audit.record(actor.id, "pledge.due_note_remove", "pledge", pledgeId, { month: m, was: previous.reason });
}
