/**
 * Records when dues started (and any pauses or stop) for pledges confirmed before the portal kept
 * schedules, by replaying their status changes from the activity log. Without it the ledger guesses,
 * and the guess moves if the earliest payment is deleted. Safe to repeat: pledges that already have a
 * schedule are left alone.
 *
 *   npm run backfill-schedules            # shows what would change
 *   npm run backfill-schedules -- --apply # saves it
 */
import { parseArgs } from "node:util";
import type { ObjectId } from "mongodb";
import { closeDb, collections } from "../src/db/mongo.js";
import { PLEDGE_STATUSES, type PledgeStatus } from "../src/domain/types.js";
import { DUE_STATUSES, scheduleFromHistory } from "../src/modules/dues/dues.rules.js";
import { scheduleUpdate } from "../src/modules/pledges/pledges.rules.js";

const { values } = parseArgs({ options: { apply: { type: "boolean", default: false } } });

const STATUS_ACTIONS = ["pledge.create", "pledge.status", "pledge.status_correct", "pledge.status_undo", "followup.create", "followup.delete"];
const isStatus = (s: unknown): s is PledgeStatus => typeof s === "string" && (PLEDGE_STATUSES as readonly string[]).includes(s);

/** The status an activity-log entry moved the pledge to, if it changed it. */
function statusIn(action: string, data: Record<string, unknown>): PledgeStatus | undefined {
  if (action === "pledge.create") return isStatus(data.status) ? data.status : "new";
  if (action.startsWith("pledge.status")) return isStatus(data.to) ? data.to : undefined;
  const change = data.status as { to?: unknown } | undefined;
  return isStatus(change?.to) ? change.to : undefined;
}

const [pledges, auditLogs, payments] = await Promise.all([collections.pledges(), collections.auditLogs(), collections.payments()]);
const todo = await pledges.find({ status: { $in: [...DUE_STATUSES] }, dueFrom: { $exists: false } }).toArray();

const firstPayments = new Map<string, string>();
for (const r of await payments
  .aggregate<{ _id: ObjectId; first: string }>([
    { $match: { pledgeId: { $in: todo.map((p) => p._id) } } },
    { $group: { _id: "$pledgeId", first: { $min: "$month" } } },
  ])
  .toArray()) {
  firstPayments.set(r._id.toHexString(), r.first);
}

let fromHistory = 0;
for (const p of todo) {
  const entries = await auditLogs.find({ entityId: p._id, action: { $in: STATUS_ACTIONS } }).sort({ createdAt: 1 }).toArray();
  const changes = entries.flatMap((e) => {
    const to = statusIn(e.action, e.data);
    return to ? [{ to, at: e.createdAt }] : [];
  });
  const { fromHistory: replayed, ...schedule } = scheduleFromHistory(p, changes, firstPayments.get(p._id.toHexString()));
  if (replayed) fromHistory++;
  const pauses = (schedule.pauses ?? []).map((x) => `${x.from}–${x.to ?? "now"}`).join(", ");
  console.log(
    `${p._id.toHexString()} ${p.status.padEnd(9)} due from ${schedule.dueFrom}` +
      `${pauses ? `, paused ${pauses}` : ""}${schedule.stoppedFrom ? `, stopped ${schedule.stoppedFrom}` : ""}` +
      `${replayed ? "" : " (best guess: history incomplete)"}`,
  );
  if (values.apply) {
    const { set, unset } = scheduleUpdate(schedule);
    await pledges.updateOne({ _id: p._id }, { $set: set, ...(unset.length ? { $unset: Object.fromEntries(unset.map((k) => [k, ""])) } : {}) });
  }
}

console.log(`\n${todo.length} pledges without a schedule; ${fromHistory} from their history, ${todo.length - fromHistory} best guesses.`);
console.log(values.apply ? "Saved." : "Nothing saved. Run again with --apply to save.");
await closeDb();
