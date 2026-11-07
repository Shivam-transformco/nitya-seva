import { MongoServerError, ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";
import type { Role, UserDoc } from "../../domain/types.js";
import { conflict } from "../../lib/errors.js";

export async function findById(id: ObjectId): Promise<UserDoc | null> {
  return (await collections.users()).findOne({ _id: id });
}

export async function findByEmail(email: string): Promise<UserDoc | null> {
  return (await collections.users()).findOne({ email: email.toLowerCase() });
}

export async function list(): Promise<UserDoc[]> {
  return (await collections.users()).find().sort({ active: -1, name: 1 }).toArray();
}

export async function listActiveByRole(role: Role): Promise<UserDoc[]> {
  return (await collections.users()).find({ role, active: true }).toArray();
}

export async function insert(user: Omit<UserDoc, "_id" | "createdAt" | "updatedAt">): Promise<UserDoc> {
  const now = new Date();
  const doc: UserDoc = { ...user, email: user.email.toLowerCase(), _id: new ObjectId(), createdAt: now, updatedAt: now };
  try {
    await (await collections.users()).insertOne(doc);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) throw conflict("A staff account with this email already exists.");
    throw err;
  }
  return doc;
}

export async function update(id: ObjectId, set: Partial<Omit<UserDoc, "_id">>, incTokenVersion = false): Promise<UserDoc | null> {
  return (await collections.users()).findOneAndUpdate(
    { _id: id },
    { $set: { ...set, updatedAt: new Date() }, ...(incTokenVersion ? { $inc: { tokenVersion: 1 } } : {}) },
    { returnDocument: "after" },
  );
}
