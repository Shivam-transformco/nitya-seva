import { ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";
import type { DueNoteDoc } from "../../domain/types.js";

export async function forPledges(pledgeIds: ObjectId[]): Promise<DueNoteDoc[]> {
  if (!pledgeIds.length) return [];
  return (await collections.dueNotes()).find({ pledgeId: { $in: pledgeIds } }).toArray();
}

export async function find(pledgeId: ObjectId, month: string): Promise<DueNoteDoc | null> {
  return (await collections.dueNotes()).findOne({ pledgeId, month });
}

export async function put(note: Omit<DueNoteDoc, "_id">): Promise<void> {
  await (await collections.dueNotes()).updateOne(
    { pledgeId: note.pledgeId, month: note.month },
    { $set: note, $setOnInsert: { _id: new ObjectId() } },
    { upsert: true },
  );
}

export async function remove(pledgeId: ObjectId, month: string): Promise<boolean> {
  return (await (await collections.dueNotes()).deleteOne({ pledgeId, month })).deletedCount === 1;
}

export async function removeForPledge(pledgeId: ObjectId): Promise<void> {
  await (await collections.dueNotes()).deleteMany({ pledgeId });
}
