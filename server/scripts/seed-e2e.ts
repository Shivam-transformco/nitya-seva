/**
 * Resets a throwaway database for the end-to-end tests: one admin with a known temporary
 * password and one old-style submission for the migration to pick up.
 * Refuses to touch anything that isn't a local database whose name ends in "_e2e".
 */
import { ObjectId } from "mongodb";
import { env } from "../src/config/env.js";
import { ensureIndexes } from "../src/db/indexes.js";
import { closeDb, collections, getDb } from "../src/db/mongo.js";
import * as users from "../src/modules/users/users.service.js";

const { MONGO_URI, MONGO_DB } = env();
const host = new URL(MONGO_URI.replace(/^mongodb(\+srv)?:/, "http:")).hostname;
if (!MONGO_DB.endsWith("_e2e") || !["localhost", "127.0.0.1"].includes(host)) {
  console.error(`Refusing to reset ${MONGO_DB} on ${host}: only local *_e2e databases may be seeded.`);
  process.exit(1);
}

await (await getDb()).dropDatabase();
await ensureIndexes();

await users.create(null, {
  name: process.env.E2E_ADMIN_NAME ?? "Test Admin",
  email: process.env.E2E_ADMIN_EMAIL ?? "admin@example.org",
  role: "admin",
  temporaryPassword: process.env.E2E_ADMIN_PASSWORD ?? "temporary-pass-1",
});

const legacy = await collections.legacySubmissions();
await legacy.insertOne({
  _id: new ObjectId(),
  name: "Legacy Devotee",
  phone: "+91 99719 32510",
  email: "",
  amount: "501",
  frequency: "Monthly",
  message: "Seva: Prachar Sahyog Seva\nSubmitted before the portal existed",
  consent: "yes",
  submittedFrom: "https://nityaseva.iskconjiasarai.com/",
  createdAt: new Date(Date.now() - 3 * 86_400_000),
});

console.log(`Seeded ${MONGO_DB}`);
await closeDb();
