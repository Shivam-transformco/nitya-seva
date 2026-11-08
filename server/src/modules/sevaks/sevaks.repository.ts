import { ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";
import type { SevakDoc } from "../../domain/types.js";

/** A number belongs to a sevak if it's their main number or one merged into them. */
const byPhone = (phone: string) => ({ $or: [{ phone }, { otherPhones: phone }] });

/** Finds the sevak by phone or creates them; refreshes name and email with the latest values given. */
export async function upsertByPhone(input: { name: string; phone: string; email: string }, at = new Date()): Promise<SevakDoc> {
  const col = await collections.sevaks();
  const doc = await col.findOneAndUpdate(
    byPhone(input.phone),
    {
      $set: { name: input.name, ...(input.email ? { email: input.email } : {}), updatedAt: at },
      $setOnInsert: { _id: new ObjectId(), phone: input.phone, createdAt: at, ...(input.email ? {} : { email: "" }) },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!doc) throw new Error("Sevak upsert returned no document");
  return doc;
}

export async function insert(input: { name: string; phone: string; email: string }): Promise<SevakDoc> {
  const now = new Date();
  const doc: SevakDoc = { ...input, _id: new ObjectId(), createdAt: now, updatedAt: now };
  await (await collections.sevaks()).insertOne(doc);
  return doc;
}

export async function findById(id: ObjectId): Promise<SevakDoc | null> {
  return (await collections.sevaks()).findOne({ _id: id });
}

export async function findByPhone(phone: string): Promise<SevakDoc | null> {
  return (await collections.sevaks()).findOne(byPhone(phone));
}

export async function findByIds(ids: ObjectId[]): Promise<Map<string, SevakDoc>> {
  if (!ids.length) return new Map();
  const docs = await (await collections.sevaks()).find({ _id: { $in: ids } }).toArray();
  return new Map(docs.map((d) => [d._id.toHexString(), d]));
}

export async function update(
  id: ObjectId,
  set: Partial<Pick<SevakDoc, "name" | "phone" | "email" | "otherPhones">>,
): Promise<SevakDoc | null> {
  return (await collections.sevaks()).findOneAndUpdate({ _id: id }, { $set: { ...set, updatedAt: new Date() } }, { returnDocument: "after" });
}

export async function remove(id: ObjectId): Promise<void> {
  await (await collections.sevaks()).deleteOne({ _id: id });
}

function searchFilter(text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const digits = text.replace(/\D/g, "");
  const or: object[] = [{ name: { $regex: escaped, $options: "i" } }, { email: { $regex: escaped, $options: "i" } }];
  if (digits.length >= 4) or.push({ phone: { $regex: digits } }, { otherPhones: { $regex: digits } });
  return { $or: or };
}

/** Sevak ids whose name, phone or email contains the search text. */
export async function searchIds(text: string, limit = 200): Promise<ObjectId[]> {
  const docs = await (await collections.sevaks()).find(searchFilter(text), { projection: { _id: 1 } }).limit(limit).toArray();
  return docs.map((d) => d._id);
}

export async function search(text: string, limit = 10): Promise<SevakDoc[]> {
  return (await collections.sevaks()).find(searchFilter(text)).sort({ name: 1 }).limit(limit).toArray();
}
