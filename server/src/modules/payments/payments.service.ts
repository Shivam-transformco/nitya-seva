import type { ObjectId } from "mongodb";
import type { z } from "zod";
import type { PaymentMethod, PledgeDoc } from "../../domain/types.js";
import { badRequest } from "../../lib/errors.js";
import { istMonth } from "../../lib/dates.js";
import type { Actor } from "../../middleware/auth.js";
import * as audit from "../audit/audit.service.js";
import { monthsBetweenGifts } from "../pledges/pledges.rules.js";
import { loadForActor, loadForPayments } from "../pledges/pledges.service.js";
import { monthsInRange, receivedAtForMonth } from "./payments.rules.js";
import * as repo from "./payments.repository.js";
import type { bulkPaymentBody, createPaymentBody } from "./payments.schema.js";

export async function list(actor: Actor, pledgeId: ObjectId) {
  await loadForActor(actor, pledgeId);
  return repo.listForPledge(pledgeId);
}

function assertCanPay(pledge: PledgeDoc) {
  if (pledge.flag) throw badRequest("This pledge is marked as not genuine. Remove the mark before recording a payment.");
  // Cancelled pledges were confirmed once; their past payments may still need entering.
  if (pledge.status !== "confirmed" && pledge.status !== "paused" && pledge.status !== "cancelled") {
    throw badRequest("Payments can only be recorded for confirmed pledges. Mark the pledge confirmed first.");
  }
}

async function insert(
  actor: Actor,
  pledge: PledgeDoc,
  p: { amount: number; month: string; method: PaymentMethod; reference: string; receivedAt: Date },
) {
  return repo.insert({
    pledgeId: pledge._id,
    sevakId: pledge.sevakId,
    amount: p.amount,
    month: p.month,
    method: p.method,
    reference: p.reference,
    receivedAt: p.receivedAt,
    recordedBy: actor.id,
    receiptNo: await repo.nextReceiptNo(istMonth(p.receivedAt).slice(0, 4)),
  });
}

export async function create(actor: Actor, pledgeId: ObjectId, input: z.infer<typeof createPaymentBody>) {
  const pledge = await loadForPayments(actor, pledgeId);
  assertCanPay(pledge);
  const payment = await insert(actor, pledge, { ...input, receivedAt: input.receivedAt ?? new Date() });
  await audit.record(actor.id, "payment.create", "pledge", pledgeId, {
    paymentId: payment._id,
    amount: payment.amount,
    month: payment.month,
    receiptNo: payment.receiptNo,
  });
  return payment;
}

/**
 * Past giving for sevaks from before the portal: one payment per gift between two months,
 * stepping by the pledge's frequency. Months that already have a payment are skipped.
 */
export async function createMany(actor: Actor, pledgeId: ObjectId, input: z.infer<typeof bulkPaymentBody>) {
  const pledge = await loadForPayments(actor, pledgeId);
  assertCanPay(pledge);
  const step = monthsBetweenGifts(pledge.frequency) ?? 1;
  const months = monthsInRange(input.fromMonth, input.toMonth, step);
  if (!months.length) throw badRequest("The first month must be on or before the last month.");
  if (months.length > 120) throw badRequest("That's more than 120 payments. Enter up to 10 years at a time.");

  const already = new Set((await repo.listForPledge(pledgeId)).map((p) => p.month));
  const toAdd = months.filter((m) => !already.has(m));
  const created = [];
  for (const month of toAdd) {
    created.push(await insert(actor, pledge, { amount: input.amount, month, method: input.method, reference: input.reference, receivedAt: receivedAtForMonth(month) }));
  }
  await audit.record(actor.id, "payment.create_many", "pledge", pledgeId, {
    from: input.fromMonth,
    to: input.toMonth,
    amount: input.amount,
    created: created.length,
    skipped: months.length - toAdd.length,
  });
  return { created: created.length, skipped: months.filter((m) => already.has(m)) };
}
