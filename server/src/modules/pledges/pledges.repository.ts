import { ObjectId, type Filter } from "mongodb";
import { collections } from "../../db/mongo.js";
import type { PledgeDoc } from "../../domain/types.js";

export async function insert(pledge: Omit<PledgeDoc, "_id" | "createdAt" | "updatedAt">, at = new Date()): Promise<PledgeDoc> {
  const doc: PledgeDoc = { ...pledge, _id: new ObjectId(), createdAt: at, updatedAt: at };
  await (await collections.pledges()).insertOne(doc);
  return doc;
}

export async function findById(id: ObjectId): Promise<PledgeDoc | null> {
  return (await collections.pledges()).findOne({ _id: id });
}

export async function list(filter: Filter<PledgeDoc>, opts: { skip: number; limit: number; sort: Record<string, 1 | -1> }) {
  const col = await collections.pledges();
  const [items, total] = await Promise.all([
    col.find(filter).sort(opts.sort).skip(opts.skip).limit(opts.limit).toArray(),
    col.countDocuments(filter),
  ]);
  return { items, total };
}

export async function update(id: ObjectId, set: Partial<Omit<PledgeDoc, "_id">>, unset: (keyof PledgeDoc)[] = []): Promise<PledgeDoc | null> {
  return (await collections.pledges()).findOneAndUpdate(
    { _id: id },
    {
      $set: { ...set, updatedAt: new Date() },
      ...(unset.length ? { $unset: Object.fromEntries(unset.map((k) => [k, ""])) } : {}),
    },
    { returnDocument: "after" },
  );
}

/** Pledges with a follow-up due by `before`, assigned to someone and still in progress. */
export async function listDue(before: Date): Promise<PledgeDoc[]> {
  return (await collections.pledges())
    .find({
      nextFollowUpAt: { $lte: before },
      assignedTo: { $exists: true },
      status: { $in: ["new", "contacted", "confirmed", "paused"] },
      flag: { $exists: false },
    })
    .toArray();
}

export async function* iterate(filter: Filter<PledgeDoc>) {
  const cursor = (await collections.pledges()).find(filter).sort({ createdAt: -1 });
  for await (const doc of cursor) yield doc;
}
