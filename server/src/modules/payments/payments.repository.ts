import { ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";
import type { PaymentDoc } from "../../domain/types.js";

export async function nextReceiptNo(year: string): Promise<string> {
  const counter = await (await collections.counters()).findOneAndUpdate(
    { _id: `receipt-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return `NS-${year}-${String(counter?.seq ?? 1).padStart(6, "0")}`;
}

export async function insert(payment: Omit<PaymentDoc, "_id" | "createdAt">): Promise<PaymentDoc> {
  const doc: PaymentDoc = { ...payment, _id: new ObjectId(), createdAt: new Date() };
  await (await collections.payments()).insertOne(doc);
  return doc;
}

export async function listForPledge(pledgeId: ObjectId): Promise<PaymentDoc[]> {
  return (await collections.payments()).find({ pledgeId }).sort({ month: -1, receivedAt: -1 }).toArray();
}
