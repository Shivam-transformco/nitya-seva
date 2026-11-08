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

export async function countForPledge(pledgeId: ObjectId): Promise<number> {
  return (await collections.payments()).countDocuments({ pledgeId });
}

export async function findById(id: ObjectId): Promise<PaymentDoc | null> {
  return (await collections.payments()).findOne({ _id: id });
}

export async function removeByIds(ids: ObjectId[]): Promise<void> {
  if (ids.length) await (await collections.payments()).deleteMany({ _id: { $in: ids } });
}

/** Puts documents back as they were, receipt numbers included; safe to repeat. */
export async function restore(docs: PaymentDoc[]): Promise<void> {
  const col = await collections.payments();
  await Promise.all(docs.map((d) => col.replaceOne({ _id: d._id }, d, { upsert: true })));
}
