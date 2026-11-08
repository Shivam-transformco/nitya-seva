import type { Filter, ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";
import type { PledgeDoc } from "../../domain/types.js";
import { addMonths, istToday } from "../../lib/dates.js";
import { notFlagged } from "../counter/counter.rules.js";
import * as usersRepo from "../users/users.repository.js";
import * as notesRepo from "./dues.repository.js";
import { DUE_STATUSES, dueDayOf, firstDueMonth, ledger, missedInRow, owedIn, type LedgerMonth } from "./dues.rules.js";

/** How far back the missed-payments list and the pledge list badges look. */
export const LOOKBACK_MONTHS = 12;

export const lookback = (today = istToday()) => ({ from: addMonths(today.month, -(LOOKBACK_MONTHS - 1)), to: today.month });

export interface PledgeLedger {
  pledge: PledgeDoc;
  months: LedgerMonth[];
  /** The first month a gift was due. */
  firstDue: string;
  /** Latest month any payment was for. */
  lastPaidMonth: string | null;
}

/** Ledgers for the pledges that have dues (confirmed, paused or cancelled, genuine, amount decided). */
export async function loadLedgers(filter: Filter<PledgeDoc>, range: { from: string; to: string }, today = istToday()): Promise<PledgeLedger[]> {
  const pledges = await (await collections.pledges())
    .find({ $and: [filter, notFlagged, { status: { $in: [...DUE_STATUSES] }, amount: { $gt: 0 } }] })
    .toArray();
  return ledgersFor(pledges, range, today);
}

export async function ledgersFor(pledges: PledgeDoc[], range: { from: string; to: string }, today = istToday()): Promise<PledgeLedger[]> {
  const ids = pledges.map((p) => p._id);
  const [payments, notes] = await Promise.all([
    ids.length
      ? (await collections.payments()).find({ pledgeId: { $in: ids } }, { projection: { pledgeId: 1, month: 1, amount: 1 } }).toArray()
      : [],
    notesRepo.forPledges(ids),
  ]);
  const paymentsOf = group(payments, (x) => x.pledgeId);
  const notesOf = group(notes, (x) => x.pledgeId);
  return pledges.map((pledge) => {
    const key = pledge._id.toHexString();
    const own = (paymentsOf.get(key) ?? []).map((x) => ({ month: x.month, amount: x.amount }));
    const noteMap = new Map(
      (notesOf.get(key) ?? []).map((n) => [n.month, { reason: n.reason, note: n.note, excused: n.excused, by: n.by, at: n.at }]),
    );
    const paidMonths = own.map((x) => x.month).sort();
    return {
      pledge,
      months: ledger(pledge, own, noteMap, range, today),
      firstDue: firstDueMonth(pledge, paidMonths[0]),
      lastPaidMonth: paidMonths.at(-1) ?? null,
    };
  });
}

function group<T>(items: T[], key: (item: T) => ObjectId): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item).toHexString();
    out.set(k, [...(out.get(k) ?? []), item]);
  }
  return out;
}

export async function userNames() {
  const names = new Map((await usersRepo.list()).map((u) => [u._id.toHexString(), u.name]));
  return (id: ObjectId) => names.get(id.toHexString()) ?? "Unknown";
}

export const withNoteName = (m: LedgerMonth, nameOf: (id: ObjectId) => string) =>
  m.note ? { ...m, note: { ...m.note, byName: nameOf(m.note.by) } } : m;

/** The last two years of a pledge's gifts, newest first, for its page. */
export async function forPledge(pledge: PledgeDoc) {
  const today = istToday();
  const [[l], nameOf] = await Promise.all([ledgersFor([pledge], { from: addMonths(today.month, -23), to: today.month }, today), userNames()]);
  if (!l?.months.length) return null;
  return {
    dueFrom: l.firstDue,
    dueDay: dueDayOf(pledge, today.month),
    missedInRow: missedInRow(l.months),
    owed: owedIn(l.months.slice(-LOOKBACK_MONTHS)),
    months: l.months.map((m) => withNoteName(m, nameOf)).reverse(),
  };
}

/** For the pledge list: which of these pledges owe money (overdue now, or missed recently). */
export async function owingFor(pledges: PledgeDoc[]): Promise<Map<string, { missedInRow: number; owed: number }>> {
  const today = istToday();
  const due = pledges.filter((p) => (DUE_STATUSES as readonly string[]).includes(p.status) && !p.flag);
  const out = new Map<string, { missedInRow: number; owed: number }>();
  for (const l of await ledgersFor(due, lookback(today), today)) {
    const inRow = missedInRow(l.months);
    if (inRow > 0) out.set(l.pledge._id.toHexString(), { missedInRow: inRow, owed: owedIn(l.months) });
  }
  return out;
}

/** Ids of pledges matching `filter` that owe money, for the "Payment overdue" list. */
export async function owingIds(filter: Filter<PledgeDoc>): Promise<ObjectId[]> {
  const ledgers = await loadLedgers(filter, lookback());
  return ledgers.filter((l) => missedInRow(l.months) > 0).map((l) => l.pledge._id);
}
