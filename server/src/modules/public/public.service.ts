import { getDb } from "../../db/mongo.js";
import { consume } from "../../lib/rateLimit.js";
import * as counter from "../counter/counter.service.js";
import * as pledges from "../pledges/pledges.service.js";
import { splitSeva, type SubmitInput } from "./public.schema.js";

const SUBMIT_LIMIT_PER_HOUR = 5;

export async function submit(input: SubmitInput, meta: { ip: string; userAgent: string }): Promise<void> {
  // Honeypot: bots fill the hidden field. Pretend success so they don't retry.
  if (input.website) return;
  await consume("submit-ip", meta.ip, SUBMIT_LIMIT_PER_HOUR, 60 * 60);

  const { seva, message } = splitSeva(input);
  await pledges.createFromSubmission({
    name: input.name,
    phone: input.phone,
    email: input.email,
    seva,
    amount: input.amount,
    message,
    source: { submittedFrom: input.submittedFrom, ip: meta.ip, userAgent: meta.userAgent.slice(0, 300) },
  });
}

/** Live counter. Which pledges count, and any manual adjustments, are decided in the counter module. */
export async function stats(): Promise<{ totalPledged: number; totalSewaks: number; target: number }> {
  const { amount, sevaks, target } = await counter.publicTotals();
  return { totalPledged: amount, totalSewaks: sevaks, target };
}

export async function health(): Promise<boolean> {
  try {
    await (await getDb()).command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
