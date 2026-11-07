import type { Filter } from "mongodb";
import { ACTIVE_PLEDGE_STATUSES, type CounterAdjustmentDoc, type PledgeDoc } from "../../domain/types.js";

export interface Totals {
  amount: number;
  sevaks: number;
}

export const notFlagged: Filter<PledgeDoc> = { flag: { $exists: false } };

/** Pledges that count towards the public counter: in progress, genuine, and not hidden by an admin. */
export const countedPledges: Filter<PledgeDoc> = {
  status: { $in: ACTIVE_PLEDGE_STATUSES },
  ...notFlagged,
  hiddenFromCounter: { $ne: true },
};

/** Active pledges an admin chose not to show. */
export const hiddenPledges: Filter<PledgeDoc> = {
  status: { $in: ACTIVE_PLEDGE_STATUSES },
  ...notFlagged,
  hiddenFromCounter: true,
};

/** Active pledges marked as not genuine. */
export const flaggedPledges: Filter<PledgeDoc> = {
  status: { $in: ACTIVE_PLEDGE_STATUSES },
  flag: { $exists: true },
};

export function adjustmentTotals(adjustments: Pick<CounterAdjustmentDoc, "amount" | "sevaks" | "active">[]): Totals {
  return adjustments
    .filter((a) => a.active)
    .reduce((t, a) => ({ amount: t.amount + a.amount, sevaks: t.sevaks + a.sevaks }), { amount: 0, sevaks: 0 });
}

/** What the public counter shows. Negative adjustments can't take it below zero. */
export function displayedTotals(real: Totals, adjustments: Pick<CounterAdjustmentDoc, "amount" | "sevaks" | "active">[]): Totals {
  const adj = adjustmentTotals(adjustments);
  return { amount: Math.max(0, real.amount + adj.amount), sevaks: Math.max(0, real.sevaks + adj.sevaks) };
}
