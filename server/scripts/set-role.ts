/**
 * Changes an existing staff account's role from the command line, e.g. to make the first owner.
 * Signs them out everywhere so the new role takes effect straight away.
 *
 *   npm run set-role -- --email you@example.com --role owner
 */
import { parseArgs } from "node:util";
import { closeDb, collections } from "../src/db/mongo.js";
import { ROLES, type Role } from "../src/domain/types.js";
import * as audit from "../src/modules/audit/audit.service.js";

const { values } = parseArgs({ options: { email: { type: "string" }, role: { type: "string" } } });
const role = values.role as Role | undefined;
if (!values.email || !role || !ROLES.includes(role)) {
  console.error(`Usage: npm run set-role -- --email you@example.com --role ${ROLES.join("|")}`);
  process.exit(1);
}

const users = await collections.users();
const user = await users.findOne({ email: values.email.trim().toLowerCase() });
if (!user) {
  console.error(`No staff account for ${values.email}`);
  process.exit(1);
}
if (user.role === role) {
  console.log(`${user.email} is already ${role}`);
} else {
  await users.updateOne({ _id: user._id }, { $set: { role, updatedAt: new Date() }, $inc: { tokenVersion: 1 } });
  await audit.record(null, "user.update", "user", user._id, { role: { from: user.role, to: role }, via: "script" });
  console.log(`${user.email}: ${user.role} → ${role}`);
}
await closeDb();
