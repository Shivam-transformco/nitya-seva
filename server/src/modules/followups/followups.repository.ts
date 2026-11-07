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
