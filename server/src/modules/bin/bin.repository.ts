import { ObjectId, type Filter } from "mongodb";
import { collections } from "../../db/mongo.js";
import type { DeletedItemDoc } from "../../domain/types.js";

export async function put(item: Omit<DeletedItemDoc, "_id" | "deletedAt">): Promise<DeletedItemDoc> {
  const doc: DeletedItemDoc = { ...item, _id: new ObjectId(), deletedAt: new Date() };
  await (await collections.deletedItems()).insertOne(doc);
  return doc;
}

export async function list(filter: Filter<DeletedItemDoc>, opts: { skip: number; limit: number }) {
  const col = await collections.deletedItems();
  const [items, total] = await Promise.all([
    col.find(filter).sort({ deletedAt: -1 }).skip(opts.skip).limit(opts.limit).toArray(),
    col.countDocuments(filter),
  ]);
  return { items, total };
}

export async function findById(id: ObjectId): Promise<DeletedItemDoc | null> {
  return (await collections.deletedItems()).findOne({ _id: id });
}

export async function remove(filter: Filter<DeletedItemDoc>): Promise<number> {
  return (await (await collections.deletedItems()).deleteMany(filter)).deletedCount;
}
