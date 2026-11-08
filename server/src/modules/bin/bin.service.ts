import type { Filter, ObjectId } from "mongodb";
import type { z } from "zod";
import type { DeletedItemDoc } from "../../domain/types.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import type { Actor } from "../../middleware/auth.js";
import * as audit from "../audit/audit.service.js";
import * as followupsRepo from "../followups/followups.repository.js";
import * as paymentsRepo from "../payments/payments.repository.js";
import * as pledgesRepo from "../pledges/pledges.repository.js";
import { loadForActor } from "../pledges/pledges.service.js";
import * as sevaksRepo from "../sevaks/sevaks.repository.js";
import * as usersRepo from "../users/users.repository.js";
import * as repo from "./bin.repository.js";
import type { listBinQuery } from "./bin.schema.js";

// Copy into the bin first, then delete: if the delete fails half way, nothing is lost and restoring is safe to repeat.

/** Admin only. The pledge leaves every list, report and the counter, along with its follow-ups and payments. */
export async function deletePledge(actor: Actor, id: ObjectId, reason: string) {
  const pledge = await loadForActor(actor, id);
  const [followups, payments] = await Promise.all([followupsRepo.allForPledge(id), paymentsRepo.listForPledge(id)]);
  await repo.put({ kind: "pledge", itemId: id, pledgeId: id, sevakId: pledge.sevakId, reason, pledge, followups, payments, deletedBy: actor.id });
  await Promise.all([
    followupsRepo.removeByIds(followups.map((f) => f._id)),
    paymentsRepo.removeByIds(payments.map((p) => p._id)),
  ]);
  await pledgesRepo.remove(id);
  await audit.record(actor.id, "pledge.delete", "pledge", id, {
    reason,
    amount: pledge.amount,
    followups: followups.length,
    payments: payments.length,
  });
}

/** Admins, or whoever recorded the payment. Its receipt number is never reused. */
export async function deletePayment(actor: Actor, pledgeId: ObjectId, paymentId: ObjectId, reason: string) {
  const pledge = await loadForActor(actor, pledgeId);
  const payment = await paymentsRepo.findById(paymentId);
  if (!payment || !payment.pledgeId.equals(pledgeId)) throw notFound("Payment");
  if (actor.role !== "admin" && !payment.recordedBy.equals(actor.id)) {
    throw forbidden("Only the person who recorded this payment, or an admin, can delete it.");
  }
  await repo.put({ kind: "payment", itemId: paymentId, pledgeId, sevakId: pledge.sevakId, reason, followups: [], payments: [payment], deletedBy: actor.id });
  await paymentsRepo.removeByIds([paymentId]);
  await audit.record(actor.id, "payment.delete", "pledge", pledgeId, {
    paymentId,
    amount: payment.amount,
    month: payment.month,
    receiptNo: payment.receiptNo,
    reason,
  });
}

export async function list(q: z.infer<typeof listBinQuery>) {
  const filter: Filter<DeletedItemDoc> = q.kind ? { kind: q.kind } : {};
  const { items, total } = await repo.list(filter, { skip: (q.page - 1) * q.limit, limit: q.limit });
  const [sevaks, users, livePledges] = await Promise.all([
    sevaksRepo.findByIds(items.map((i) => i.sevakId)),
    usersRepo.list(),
    pledgesRepo.existing(items.filter((i) => i.kind !== "pledge").map((i) => i.pledgeId)),
  ]);
  const names = new Map(users.map((u) => [u._id.toHexString(), u.name]));
  return {
    items: items.map((i) => ({
      _id: i._id,
      kind: i.kind,
      pledgeId: i.pledgeId,
      reason: i.reason,
      deletedAt: i.deletedAt,
      deletedByName: names.get(i.deletedBy.toHexString()) ?? "Unknown",
      sevakName: sevaks.get(i.sevakId.toHexString())?.name ?? "Unknown sevak",
      pledge: i.pledge ? { amount: i.pledge.amount, seva: i.pledge.seva, status: i.pledge.status, createdAt: i.pledge.createdAt } : null,
      followups: i.followups.map((f) => ({ _id: f._id, channel: f.channel, outcome: f.outcome, note: f.note, createdAt: f.createdAt })),
      payments: i.payments.map((p) => ({ _id: p._id, amount: p.amount, month: p.month, method: p.method, receiptNo: p.receiptNo })),
      /** A follow-up or payment can only go back once its pledge exists. */
      canRestore: i.kind === "pledge" || livePledges.has(i.pledgeId.toHexString()),
    })),
    total,
    page: q.page,
    limit: q.limit,
  };
}

/** Admin only. Puts the item back exactly as it was. */
export async function restore(actor: Actor, id: ObjectId) {
  const item = await repo.findById(id);
  if (!item) throw notFound("Deleted item");
  if (item.kind === "pledge") {
    if (!item.pledge) throw badRequest("This entry has no pledge to restore.");
    await pledgesRepo.restore(item.pledge);
  } else if (!(await pledgesRepo.findById(item.pledgeId))) {
    throw badRequest("Its pledge was deleted too. Restore the pledge first.");
  }
  await Promise.all([followupsRepo.restore(item.followups), paymentsRepo.restore(item.payments)]);
  if (item.kind === "followup") {
    const latest = await followupsRepo.latestForPledge(item.pledgeId);
    if (latest) await pledgesRepo.update(item.pledgeId, { lastContactAt: latest.createdAt });
  }
  await repo.remove({ _id: id });
  await audit.record(actor.id, `${item.kind}.restore`, "pledge", item.pledgeId, { itemId: item.itemId });
  return { pledgeId: item.pledgeId };
}

/** Admin only. Gone for good; a pledge takes its separately deleted follow-ups and payments with it. */
export async function purge(actor: Actor, id: ObjectId) {
  const item = await repo.findById(id);
  if (!item) throw notFound("Deleted item");
  const removed = await repo.remove(item.kind === "pledge" ? { pledgeId: item.pledgeId } : { _id: id });
  await audit.record(actor.id, `${item.kind}.purge`, "pledge", item.pledgeId, { itemId: item.itemId, entries: removed });
}
