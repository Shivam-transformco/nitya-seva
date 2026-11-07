import { ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";
import type { NotificationDoc } from "../../domain/types.js";

export type NewNotification = Omit<NotificationDoc, "_id" | "createdAt" | "readAt">;

export async function insertMany(items: NewNotification[]): Promise<void> {
  if (!items.length) return;
  const col = await collections.notifications();
  const now = new Date();
  await col.insertMany(items.map((n) => ({ ...n, _id: new ObjectId(), createdAt: now })));
}

export async function listForUser(userId: ObjectId, opts: { unreadOnly: boolean; skip: number; limit: number }) {
  const col = await collections.notifications();
  const filter = { userId, ...(opts.unreadOnly ? { readAt: { $exists: false } } : {}) };
  const [items, total, unread] = await Promise.all([
    col.find(filter).sort({ createdAt: -1 }).skip(opts.skip).limit(opts.limit).toArray(),
    col.countDocuments(filter),
    col.countDocuments({ userId, readAt: { $exists: false } }),
  ]);
  return { items, total, unread };
}

export async function markRead(userId: ObjectId, id: ObjectId): Promise<boolean> {
  const col = await collections.notifications();
  const res = await col.updateOne({ _id: id, userId }, { $set: { readAt: new Date() } });
  return res.matchedCount > 0;
}

export async function markAllRead(userId: ObjectId): Promise<number> {
  const col = await collections.notifications();
  const res = await col.updateMany({ userId, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  return res.modifiedCount;
}

/** True when the user already has an unread notification of this type for this link (avoids daily duplicates). */
export async function hasUnread(userId: ObjectId, type: NotificationDoc["type"], link: string): Promise<boolean> {
  const col = await collections.notifications();
  return (await col.countDocuments({ userId, type, link, readAt: { $exists: false } }, { limit: 1 })) > 0;
}
