import { ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";
import type { CounterAdjustmentDoc, CounterSettingsDoc } from "../../domain/types.js";

export async function getSettings(): Promise<CounterSettingsDoc | null> {
  return (await collections.settings()).findOne({ _id: "counter" });
}

export async function saveTarget(target: number, by: ObjectId): Promise<CounterSettingsDoc> {
  const doc: CounterSettingsDoc = { _id: "counter", target, updatedBy: by, updatedAt: new Date() };
  await (await collections.settings()).replaceOne({ _id: "counter" }, doc, { upsert: true });
  return doc;
}

export async function list(): Promise<CounterAdjustmentDoc[]> {
  return (await collections.counterAdjustments()).find().sort({ createdAt: -1 }).toArray();
}

export async function listActive(): Promise<CounterAdjustmentDoc[]> {
  return (await collections.counterAdjustments()).find({ active: true }).toArray();
}

export async function findById(id: ObjectId): Promise<CounterAdjustmentDoc | null> {
  return (await collections.counterAdjustments()).findOne({ _id: id });
}

export async function insert(input: Omit<CounterAdjustmentDoc, "_id" | "createdAt" | "updatedAt">): Promise<CounterAdjustmentDoc> {
  const now = new Date();
  const doc: CounterAdjustmentDoc = { ...input, _id: new ObjectId(), createdAt: now, updatedAt: now };
  await (await collections.counterAdjustments()).insertOne(doc);
  return doc;
}

export async function update(
  id: ObjectId,
  set: Partial<Pick<CounterAdjustmentDoc, "label" | "amount" | "sevaks" | "note" | "active">>,
): Promise<CounterAdjustmentDoc | null> {
  return (await collections.counterAdjustments()).findOneAndUpdate(
    { _id: id },
    { $set: { ...set, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
}

export async function remove(id: ObjectId): Promise<boolean> {
  return (await (await collections.counterAdjustments()).deleteOne({ _id: id })).deletedCount > 0;
}
