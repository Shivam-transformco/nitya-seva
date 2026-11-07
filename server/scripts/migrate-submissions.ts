/**
 * Copies the old `submissions` collection into `sevaks` + `pledges`.
 * Read-only on `submissions`; safe to run repeatedly (skips anything already migrated via `legacyId`).
 *
 *   npm run migrate            # do it
 *   npm run migrate -- --dry   # only report what would happen
 */
import { ensureIndexes } from "../src/db/indexes.js";
import { closeDb, collections } from "../src/db/mongo.js";
import { normalizePhone } from "../src/lib/phone.js";
import { splitSeva } from "../src/modules/public/public.schema.js";
import * as pledgesRepo from "../src/modules/pledges/pledges.repository.js";
import * as sevaksRepo from "../src/modules/sevaks/sevaks.repository.js";

const dry = process.argv.includes("--dry");

await ensureIndexes();
const [legacy, pledges] = await Promise.all([collections.legacySubmissions(), collections.pledges()]);

let migrated = 0;
let skippedExisting = 0;
const problems: string[] = [];

for await (const s of legacy.find().sort({ createdAt: 1 })) {
  if (await pledges.countDocuments({ legacyId: s._id }, { limit: 1 })) {
    skippedExisting++;
    continue;
  }
  const phone = normalizePhone(String(s.phone ?? ""));
  const amount = Number(String(s.amount ?? "").replace(/[,\s₹]/g, ""));
  if (!phone) {
    problems.push(`${s._id}: phone "${s.phone}" is not valid`);
    continue;
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    problems.push(`${s._id}: amount "${s.amount}" is not a whole number of rupees`);
    continue;
  }

  if (!dry) {
    const createdAt = s.createdAt ?? s._id.getTimestamp();
    const sevak = await sevaksRepo.upsertByPhone({ name: String(s.name).trim(), phone, email: String(s.email ?? "").trim() }, createdAt);
    const { seva, message } = splitSeva({ message: String(s.message ?? "") });
    await pledgesRepo.insert(
      {
        sevakId: sevak._id,
        seva,
        amount,
        frequency: "Monthly",
        status: "new",
        message,
        consent: s.consent === "yes" || s.consent === true,
        source: { submittedFrom: String(s.submittedFrom ?? "") },
        nextFollowUpAt: createdAt,
        legacyId: s._id,
      },
      createdAt,
    );
  }
  migrated++;
}

console.log(`${dry ? "[dry run] would migrate" : "Migrated"}: ${migrated}`);
console.log(`Already migrated: ${skippedExisting}`);
if (problems.length) {
  console.log(`Needs manual review (${problems.length}):`);
  for (const p of problems) console.log(`  ${p}`);
}
await closeDb();
