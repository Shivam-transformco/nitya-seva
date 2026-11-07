/**
 * Creates an admin with a random temporary password (they must change it on first login).
 *
 *   npm run create-admin -- --name "Radha Devi" --email radha@example.com
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { ensureIndexes } from "../src/db/indexes.js";
import { closeDb } from "../src/db/mongo.js";
import { parse } from "../src/lib/http.js";
import { createUserBody } from "../src/modules/users/users.schema.js";
import * as users from "../src/modules/users/users.service.js";

const { values } = parseArgs({ options: { name: { type: "string" }, email: { type: "string" } } });
if (!values.name || !values.email) {
  console.error('Usage: npm run create-admin -- --name "Full Name" --email you@example.com');
  process.exit(1);
}

const temporaryPassword = randomBytes(12).toString("base64url");
const input = parse(createUserBody, { name: values.name, email: values.email, role: "admin", temporaryPassword });
await ensureIndexes();
const user = await users.create(null, input);
console.log(`Created admin ${user.email}`);
console.log(`Temporary password (shown once): ${temporaryPassword}`);
await closeDb();
