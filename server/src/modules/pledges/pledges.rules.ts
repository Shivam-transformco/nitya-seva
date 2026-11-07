import type { FollowupOutcome, PledgeStatus } from "../../domain/types.js";

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

/** The status a pledge moves to after a follow-up with this outcome, or null to leave it unchanged. */
export function statusAfterFollowup(current: PledgeStatus, outcome: FollowupOutcome): PledgeStatus | null {
  const target: PledgeStatus | null =
    outcome === "confirmed" ? "confirmed" : outcome === "declined" ? "lost" : current === "new" ? "contacted" : null;
  if (!target || target === current) return null;
  // A declined call from someone already confirmed is a cancellation, not a lost lead.
  if (outcome === "declined" && (current === "confirmed" || current === "paused")) return "cancelled";
  return canTransition(current, target) ? target : null;
}
