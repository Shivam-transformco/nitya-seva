import { ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";
import type { FollowupDoc } from "../../domain/types.js";

export async function insert(followup: Omit<FollowupDoc, "_id" | "createdAt">): Promise<FollowupDoc> {
  const doc: FollowupDoc = { ...followup, _id: new ObjectId(), createdAt: new Date() };
  await (await collections.followups()).insertOne(doc);
  return doc;
}

export async function listForPledge(pledgeId: ObjectId): Promise<FollowupDoc[]> {
  return (await collections.followups()).find({ pledgeId }).sort({ createdAt: -1 }).limit(200).toArray();
}

export async function allForPledge(pledgeId: ObjectId): Promise<FollowupDoc[]> {
  return (await collections.followups()).find({ pledgeId }).toArray();
}

export async function findById(id: ObjectId): Promise<FollowupDoc | null> {
  return (await collections.followups()).findOne({ _id: id });
}

export async function latestForPledge(pledgeId: ObjectId): Promise<FollowupDoc | null> {
  return (await collections.followups()).findOne({ pledgeId }, { sort: { createdAt: -1 } });
}

export async function removeByIds(ids: ObjectId[]): Promise<void> {
  if (ids.length) await (await collections.followups()).deleteMany({ _id: { $in: ids } });
}

/** Puts documents back as they were; safe to repeat. */
export async function restore(docs: FollowupDoc[]): Promise<void> {
  const col = await collections.followups();
  await Promise.all(docs.map((d) => col.replaceOne({ _id: d._id }, d, { upsert: true })));
}
