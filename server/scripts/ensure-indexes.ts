import { ensureIndexes } from "../src/db/indexes.js";
import { closeDb } from "../src/db/mongo.js";

await ensureIndexes();
console.log("Indexes are in place.");
await closeDb();
