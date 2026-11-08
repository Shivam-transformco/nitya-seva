import type { DueNoteDoc, Pause, PledgeDoc, PledgeStatus, Schedule } from "../../domain/types.js";
import { addMonths, daysInMonth, istMonth, monthsBetween } from "../../lib/dates.js";
import { monthsBetweenGifts, scheduleAfter } from "../pledges/pledges.rules.js";

/**
 * - paid / partial: money came for it (partial = less than the pledged amount)
 * - excused: staff recorded a reason and chose not to count it as missed
 * - paused: the pledge was paused, so nothing was due
 * - due: this month, before its due day; overdue: this month, after it; missed: an earlier month
 */
export const MONTH_STATES = ["paid", "partial", "excused", "paused", "due", "overdue", "missed"] as const;
export type MonthState = (typeof MONTH_STATES)[number];

/** States that still owe money. */
export const OWING: readonly MonthState[] = ["partial", "overdue", "missed"];

export interface LedgerMonth {
  month: string;
  expected: number;
  paid: number;
  state: MonthState;
  note?: Pick<DueNoteDoc, "reason" | "note" | "excused" | "by" | "at">;
}

export type LedgerPledge = Pick<
  PledgeDoc,
  | "amount"
  | "frequency"
  | "status"
  | "dueFrom"
  | "dueDay"
  | "pauses"
  | "stoppedFrom"
  | "amountHistory"
  | "paymentSetup"
  | "givingSince"
  | "lastStatusChange"
  | "createdAt"
  | "updatedAt"
>;

/** Statuses that have dues. */
export const DUE_STATUSES = ["confirmed", "paused", "cancelled"] as const;

/**
 * The schedule the ledger works from. Pledges confirmed before schedules were kept have none until
 * `scripts/backfill-schedules.ts` runs; for those it's a best guess: dues start at "giving since", the
 * mandate's first month, the month they were confirmed (if that was the last change) or created, or an
 * earlier payment; a paused or cancelled one counts as paused or stopped since its last status change.
 */
export function scheduleFor(p: LedgerPledge, firstPaymentMonth?: string): Required<Pick<Schedule, "dueFrom" | "pauses">> & Schedule {
  if (p.dueFrom) return { dueFrom: p.dueFrom, pauses: p.pauses ?? [], ...(p.stoppedFrom ? { stoppedFrom: p.stoppedFrom } : {}) };
  const changed = istMonth(p.lastStatusChange?.at ?? p.updatedAt);
  const confirmed = p.lastStatusChange?.to === "confirmed" ? changed : undefined;
  const guess = p.givingSince ?? p.paymentSetup?.mandate?.startMonth ?? confirmed ?? istMonth(p.createdAt);
  return {
    dueFrom: firstPaymentMonth && firstPaymentMonth < guess ? firstPaymentMonth : guess,
    pauses: p.status === "paused" ? [{ from: changed }] : [],
    ...(p.status === "cancelled" ? { stoppedFrom: changed } : {}),
  };
}

/**
 * The schedule an older pledge would have had, replaying its status changes from the activity log
 * (`changes` oldest first). Falls back to the best guess when the log doesn't end at the pledge's
 * current status (changes from before the log existed). A payment for an earlier month moves the start back.
 */
export function scheduleFromHistory(
  p: LedgerPledge,
  changes: { to: PledgeStatus; at: Date }[],
  firstPaymentMonth?: string,
): Schedule & { dueFrom: string; fromHistory: boolean } {
  let status: PledgeStatus = "new";
  let s: Schedule = {};
  for (const c of changes) {
    if (c.to === status) continue;
    s = scheduleAfter({ ...s, givingSince: p.givingSince, paymentSetup: p.paymentSetup }, c.to, istMonth(c.at));
    status = c.to;
  }
  if (status !== p.status || !s.dueFrom) return { ...scheduleFor({ ...p, dueFrom: undefined }, firstPaymentMonth), fromHistory: false };
  const dueFrom = firstPaymentMonth && firstPaymentMonth < s.dueFrom ? firstPaymentMonth : s.dueFrom;
  return { ...s, dueFrom, fromHistory: true };
}

/** The day of the month a gift is due: the pledge's own, else the mandate's debit day, else the last day. */
export function dueDayOf(p: Pick<LedgerPledge, "dueDay" | "paymentSetup">, month: string): number {
  const last = daysInMonth(month);
  return Math.min(p.dueDay ?? p.paymentSetup?.mandate?.debitDay ?? last, last);
}

/**
 * The amount pledged for a month, from the amount history when it has changed since.
 * ₹0 means the amount wasn't known yet, so those months use the amount entered later.
 */
export function amountFor(p: Pick<LedgerPledge, "amount" | "amountHistory">, month: string): number {
  for (const h of p.amountHistory ?? []) if (h.amount > 0 && month < istMonth(h.until)) return h.amount;
  return p.amount;
}

const pausedIn = (pauses: Pause[], month: string) => pauses.some((x) => x.from <= month && (!x.to || month <= x.to));

/**
 * Every month a gift was due, from `from` to `to` (both "YYYY-MM"), never past today.
 * A payment counts towards the gift whose period it falls in (a quarterly gift due in April
 * covers payments for April to June).
 */
export function ledger(
  p: LedgerPledge,
  payments: { month: string; amount: number }[],
  notes: Map<string, LedgerMonth["note"]>,
  range: { from: string; to: string },
  today: { month: string; day: number },
): LedgerMonth[] {
  if (!(DUE_STATUSES as readonly string[]).includes(p.status) || p.amount <= 0) return [];
  const schedule = scheduleFor(p, payments.map((x) => x.month).sort()[0]);
  const start = schedule.dueFrom;
  const step = monthsBetweenGifts(p.frequency);
  const end = [range.to, today.month, schedule.stoppedFrom ? addMonths(schedule.stoppedFrom, -1) : "9999-12"].sort()[0]!;

  const out: LedgerMonth[] = [];
  const months = step === null ? [start] : [];
  if (step !== null) {
    // First due month on or after `range.from`.
    const skip = Math.max(0, Math.ceil(monthsBetween(start, range.from) / step));
    for (let m = addMonths(start, skip * step); m <= end; m = addMonths(m, step)) months.push(m);
  }
  for (const month of months) {
    if (month < range.from || month > end) continue;
    const periodEnd = step === null ? "9999-12" : addMonths(month, step - 1);
    const paid = payments.filter((x) => x.month >= month && x.month <= periodEnd).reduce((s, x) => s + x.amount, 0);
    const note = notes.get(month);
    const expected = amountFor(p, month);
    let state: MonthState;
    if (paid >= expected) state = "paid";
    else if (note?.excused) state = "excused";
    else if (paid === 0 && pausedIn(schedule.pauses, month)) state = "paused";
    else if (paid > 0) state = "partial";
    else if (month < today.month) state = "missed";
    else state = today.day > dueDayOf(p, month) ? "overdue" : "due";
    out.push({ month, expected: state === "paused" ? 0 : expected, paid, state, ...(note ? { note } : {}) });
  }
  return out;
}

/** Months owed in a row, counting back from the latest (a paid, excused or paused month ends the run). */
export function missedInRow(months: LedgerMonth[]): number {
  let n = 0;
  for (let i = months.length - 1; i >= 0; i--) {
    const state = months[i]!.state;
    if (state === "due") continue;
    if (!OWING.includes(state)) break;
    n++;
  }
  return n;
}

/** The months not (fully) paid and not excused, oldest first, including ones before a later payment. */
export const unpaidMonths = (months: LedgerMonth[]) => months.filter((m) => OWING.includes(m.state)).map((m) => m.month);

/** What's still owed across the months: the unpaid part of each owing month. */
export const owedIn = (months: LedgerMonth[]) =>
  months.filter((m) => OWING.includes(m.state)).reduce((s, m) => s + Math.max(0, m.expected - m.paid), 0);

export interface MonthTotals {
  month: string;
  /** Pledged for the month, leaving out paused pledges. */
  committed: number;
  /** Received against what was pledged (capped at each pledge's amount). */
  collected: number;
  /** Still to come and not excused. */
  outstanding: number;
  /** Excused by staff. */
  excused: number;
  sevaks: Record<MonthState, number>;
}

export function totalsFor(month: string, rows: LedgerMonth[]): MonthTotals {
  const t: MonthTotals = {
    month,
    committed: 0,
    collected: 0,
    outstanding: 0,
    excused: 0,
    sevaks: Object.fromEntries(MONTH_STATES.map((s) => [s, 0])) as Record<MonthState, number>,
  };
  for (const r of rows) {
    t.sevaks[r.state]++;
    if (r.state === "paused") continue;
    t.committed += r.expected;
    t.collected += Math.min(r.paid, r.expected);
    const gap = Math.max(0, r.expected - r.paid);
    if (r.state === "excused") t.excused += gap;
    else t.outstanding += gap;
  }
  return t;
}
