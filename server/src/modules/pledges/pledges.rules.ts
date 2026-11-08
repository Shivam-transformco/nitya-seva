import type { FollowupOutcome, PledgeDoc, PledgeStatus } from "../../domain/types.js";

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

/** The status a pledge moves to after a follow-up with this outcome, or null to leave it unchanged. */
export function statusAfterFollowup(current: PledgeStatus, outcome: FollowupOutcome): PledgeStatus | null {
  const target: PledgeStatus | null =
    outcome === "confirmed" ? "confirmed" : outcome === "declined" ? "lost" : current === "new" ? "contacted" : null;
  if (!target || target === current) return null;
  // A declined call from someone already confirmed is a cancellation, not a lost lead.
  if (outcome === "declined" && (current === "confirmed" || current === "paused")) return "cancelled";
  return canTransition(current, target) ? target : null;
}
