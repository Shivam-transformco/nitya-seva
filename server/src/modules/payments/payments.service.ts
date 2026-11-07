import type { ObjectId } from "mongodb";
import type { z } from "zod";
import { badRequest } from "../../lib/errors.js";
import { istMonth } from "../../lib/dates.js";
import type { Actor } from "../../middleware/auth.js";
import * as audit from "../audit/audit.service.js";
import { loadForActor } from "../pledges/pledges.service.js";
import * as repo from "./payments.repository.js";
import type { createPaymentBody } from "./payments.schema.js";

export async function list(actor: Actor, pledgeId: ObjectId) {
  await loadForActor(actor, pledgeId);
  return repo.listForPledge(pledgeId);
}

export async function create(actor: Actor, pledgeId: ObjectId, input: z.infer<typeof createPaymentBody>) {
  const pledge = await loadForActor(actor, pledgeId);
  if (pledge.flag) throw badRequest("This pledge is marked as not genuine. Remove the mark before recording a payment.");
  if (pledge.status !== "confirmed" && pledge.status !== "paused") {
    throw badRequest("Payments can only be recorded for confirmed pledges. Mark the pledge confirmed first.");
  }
  const receivedAt = input.receivedAt ?? new Date();
  const payment = await repo.insert({
    pledgeId,
    sevakId: pledge.sevakId,
    amount: input.amount,
    month: input.month,
    method: input.method,
    reference: input.reference,
    receivedAt,
    recordedBy: actor.id,
    receiptNo: await repo.nextReceiptNo(istMonth(receivedAt).slice(0, 4)),
  });
  await audit.record(actor.id, "payment.create", "pledge", pledgeId, {
    paymentId: payment._id,
    amount: payment.amount,
    month: payment.month,
    receiptNo: payment.receiptNo,
  });
  return payment;
}
