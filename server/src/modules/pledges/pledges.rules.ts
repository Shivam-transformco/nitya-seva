import type { Filter } from "mongodb";
import type { Frequency, FollowupOutcome, Pause, PledgeDoc, PledgeOrigin, PledgeStatus, Schedule } from "../../domain/types.js";
import { addMonths, istMonth, startOfIstMonth } from "../../lib/dates.js";

const MONTHS_PER_GIFT: Record<Frequency, number | null> = {
  Monthly: 1,
  Quarterly: 3,
  "Half-yearly": 6,
  Yearly: 12,
  "One-time": null,
};

/** Months between gifts, or null for a one-time gift. */
export const monthsBetweenGifts = (frequency: Frequency) => MONTHS_PER_GIFT[frequency];

/** What a pledge adds to the monthly total. A one-time gift isn't a monthly commitment, so it adds nothing. */
export function monthlyEquivalent(amount: number, frequency: Frequency): number {
  const months = MONTHS_PER_GIFT[frequency];
  return months ? Math.round(amount / months) : 0;
}

/** For aggregations: the stored monthly figure, or the amount on pledges from before it was stored (all monthly). */
export const MONTHLY_AMOUNT = { $ifNull: ["$monthly", "$amount"] };

/** Pledges saved before `origin` existed have none; this reads them as the website or the old database. */
export const originOf = (p: Pick<PledgeDoc, "origin" | "legacyId">): PledgeOrigin => p.origin ?? (p.legacyId ? "legacy" : "website");

export function originFilter(origin: PledgeOrigin): Filter<PledgeDoc> {
  if (origin === "website") return { $or: [{ origin: "website" }, { origin: { $exists: false }, legacyId: { $exists: false } }] };
  if (origin === "legacy") return { $or: [{ origin: "legacy" }, { origin: { $exists: false }, legacyId: { $exists: true } }] };
  return { origin };
}

const TRANSITIONS: Record<PledgeStatus, PledgeStatus[]> = {
  new: ["contacted", "confirmed", "lost"],
  contacted: ["confirmed", "lost"],
  confirmed: ["paused", "cancelled"],
  paused: ["confirmed", "cancelled"],
  cancelled: ["confirmed"],
  lost: ["contacted"],
};

export function canTransition(from: PledgeStatus, to: PledgeStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedNext(from: PledgeStatus): PledgeStatus[] {
  return TRANSITIONS[from];
}

/** Lost and cancelled pledges need no follow-up. */
export const isClosed = (status: PledgeStatus) => status === "lost" || status === "cancelled";

/** A pledge with payments recorded was confirmed at some point, so it can't go back to one of these. */
const NEVER_PAID: PledgeStatus[] = ["new", "contacted", "lost"];
export const conflictsWithPayments = (status: PledgeStatus, paymentCount: number) => paymentCount > 0 && NEVER_PAID.includes(status);

/** The status "undo" would put back, or null when there's nothing to undo or the status has moved on since. */
export function undoTarget(pledge: Pick<PledgeDoc, "status" | "lastStatusChange">): PledgeStatus | null {
  const change = pledge.lastStatusChange;
  return change && change.to === pledge.status ? change.from : null;
}

/**
 * The pledge's schedule after it moves to `to` in `month`.
 * - Confirming starts the dues (from "giving since" or the mandate's first month if set) and ends a pause;
 *   coming back after a cancellation counts the gap as a pause.
 * - Pausing opens a pause from this month; cancelling stops dues from this month.
 * - Any other status (only reachable by correction once confirmed) means nothing is due.
 */
export function scheduleAfter(
  p: Schedule & Pick<PledgeDoc, "givingSince" | "paymentSetup">,
  to: PledgeStatus,
  month: string,
): Schedule {
  if (to !== "confirmed" && to !== "paused" && to !== "cancelled") return {};
  const dueFrom = p.dueFrom ?? p.givingSince ?? p.paymentSetup?.mandate?.startMonth ?? month;
  const pauses: Pause[] = (p.pauses ?? []).map((x) => ({ ...x }));
  const lastMonth = addMonths(month, -1);
  const closeOpen = () => {
    const open = pauses.findIndex((x) => !x.to);
    if (open < 0) return;
    if (lastMonth < pauses[open]!.from) pauses.splice(open, 1);
    else pauses[open]!.to = lastMonth;
  };
  if (p.stoppedFrom && to !== "cancelled" && p.stoppedFrom <= lastMonth) pauses.push({ from: p.stoppedFrom, to: lastMonth });

  if (to === "paused") {
    if (!pauses.some((x) => !x.to)) pauses.push({ from: month });
    return { dueFrom, pauses };
  }
  closeOpen();
  return { dueFrom, pauses, ...(to === "cancelled" ? { stoppedFrom: p.stoppedFrom ?? month } : {}) };
}

type AmountEntry = NonNullable<PledgeDoc["amountHistory"]>[number];

/**
 * The amount history once the amount changes from `from` ("YYYY-MM") on: earlier months keep what
 * they had, anything recorded from `from` on is replaced. ₹0 entries (amount not known yet) are dropped.
 */
export function amountHistoryFrom(
  history: AmountEntry[],
  current: Pick<AmountEntry, "amount" | "frequency">,
  from: string,
  by: AmountEntry["by"],
): AmountEntry[] {
  const fromDate = startOfIstMonth(from);
  const out: AmountEntry[] = [];
  let start: string | undefined;
  for (const h of [...history.filter((x) => x.amount > 0), { ...current, until: new Date(Date.UTC(9999, 0)), by }]) {
    const end = istMonth(h.until);
    if (end <= from) out.push(h);
    else {
      if (start === undefined || start < from) out.push({ ...h, until: fromDate });
      break;
    }
    start = end;
  }
  return out;
}

/** Statuses that start, pause or stop dues, so they can take effect from an earlier month. */
export const DATED_STATUSES: readonly PledgeStatus[] = ["confirmed", "paused", "cancelled"];

/** The latest month the schedule already records; a backdated status change can't start before it. */
export function lastScheduledMonth(s: Schedule): string | undefined {
  const months = [s.dueFrom, s.stoppedFrom, ...(s.pauses ?? []).flatMap((x) => [x.from, x.to])].filter((m): m is string => Boolean(m));
  return months.sort().at(-1);
}

/** The fields of a schedule as a `$set`/`$unset` pair; empty values are removed. */
export function scheduleUpdate(s: Schedule): { set: Partial<PledgeDoc>; unset: (keyof PledgeDoc)[] } {
  const set: Partial<PledgeDoc> = {};
  const unset: (keyof PledgeDoc)[] = [];
  if (s.dueFrom) set.dueFrom = s.dueFrom;
  else unset.push("dueFrom");
  if (s.pauses?.length) set.pauses = s.pauses;
  else unset.push("pauses");
  if (s.stoppedFrom) set.stoppedFrom = s.stoppedFrom;
  else unset.push("stoppedFrom");
  return { set, unset };
}

export const scheduleOf = (p: Schedule): Schedule => ({
  ...(p.dueFrom ? { dueFrom: p.dueFrom } : {}),
  ...(p.pauses?.length ? { pauses: p.pauses } : {}),
  ...(p.stoppedFrom ? { stoppedFrom: p.stoppedFrom } : {}),
});

/** The status a pledge moves to after a follow-up with this outcome, or null to leave it unchanged. */
export function statusAfterFollowup(current: PledgeStatus, outcome: FollowupOutcome): PledgeStatus | null {
  const target: PledgeStatus | null =
    outcome === "confirmed" ? "confirmed" : outcome === "declined" ? "lost" : current === "new" ? "contacted" : null;
  if (!target || target === current) return null;
  // A declined call from someone already confirmed is a cancellation, not a lost lead.
  if (outcome === "declined" && (current === "confirmed" || current === "paused")) return "cancelled";
  return canTransition(current, target) ? target : null;
}
