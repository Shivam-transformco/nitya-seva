import { MongoClient, type Collection, type Db, type Document } from "mongodb";
import { env } from "../config/env.js";
import type {
  AuditLogDoc,
  CounterAdjustmentDoc,
  CounterDoc,
  FollowupDoc,
  LegacySubmissionDoc,
  NotificationDoc,
  PaymentDoc,
  PledgeDoc,
  RateLimitDoc,
  SevakDoc,
  UserDoc,
} from "../domain/types.js";

// Reused across invocations of the same serverless instance.
let clientPromise: Promise<MongoClient> | undefined;

function getClient(): Promise<MongoClient> {
  clientPromise ??= new MongoClient(env().MONGO_URI, { maxPoolSize: 10 }).connect().catch((err) => {
    clientPromise = undefined;
    throw err;
  });
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db(env().MONGO_DB);
}

export async function closeDb(): Promise<void> {
  if (!clientPromise) return;
  const client = await clientPromise;
  clientPromise = undefined;
  await client.close();
}

const collection =
  <T extends Document>(name: string) =>
  async (): Promise<Collection<T>> =>
    (await getDb()).collection<T>(name);

export const collections = {
  users: collection<UserDoc>("users"),
  sevaks: collection<SevakDoc>("sevaks"),
  pledges: collection<PledgeDoc>("pledges"),
  followups: collection<FollowupDoc>("followups"),
  payments: collection<PaymentDoc>("payments"),
  notifications: collection<NotificationDoc>("notifications"),
  auditLogs: collection<AuditLogDoc>("auditLogs"),
  counters: collection<CounterDoc>("counters"),
  counterAdjustments: collection<CounterAdjustmentDoc>("counterAdjustments"),
  rateLimits: collection<RateLimitDoc>("rateLimits"),
  legacySubmissions: collection<LegacySubmissionDoc>("submissions"),
};
