import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { serverEnv } from "./env.js";

const serverDir = fileURLToPath(new URL("../server", import.meta.url));
const run = (script) =>
  execFileSync("npx", ["tsx", script], { cwd: serverDir, env: { ...process.env, ...serverEnv }, stdio: "inherit" });

export default function globalSetup() {
  run("scripts/seed-e2e.ts");
  // Exercise the real migration the same way production will run it.
  run("scripts/migrate-submissions.ts");
}
