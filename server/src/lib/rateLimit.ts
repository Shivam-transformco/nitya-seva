import { collections } from "../db/mongo.js";
import { rateLimited } from "./errors.js";

/**
 * Fixed-window limiter stored in MongoDB, so it holds across serverless instances.
 * Throws RATE_LIMITED once `limit` hits within `windowSeconds` for the same bucket and key.
 */
export async function consume(bucket: string, key: string, limit: number, windowSeconds: number): Promise<void> {
  const col = await collections.rateLimits();
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  const _id = `${bucket}:${key}:${windowStart}`;

  const doc = await col.findOneAndUpdate(
    { _id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowSeconds * 1000) } },
    { upsert: true, returnDocument: "after" },
  );
  if ((doc?.count ?? 0) > limit) throw rateLimited();
}
