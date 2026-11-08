import { z } from "zod";
import { normalizePhone } from "../../lib/phone.js";

export const DEFAULT_SEVA = "Prachar Sahyog Seva";

export const sevakName = z.string().trim().min(1, "is required").max(100);
export const sevakEmail = z.union([z.literal(""), z.email().max(200)]);
export const sevakPhone = z
  .string()
  .max(30)
  .transform((s, ctx) => {
    const phone = normalizePhone(s);
    if (!phone) ctx.addIssue({ code: "custom", message: "is not a valid phone number" });
    return phone ?? "";
  });

/** Matches what the public site sends today (amount as a string, consent as "yes"). */
export const submitBody = z.object({
  name: sevakName,
  phone: sevakPhone,
  email: sevakEmail.default(""),
  amount: z.coerce
    .number({ error: "must be a number" })
    .int("must be a whole number of rupees")
    .min(1)
    .max(10_00_000, "is larger than we can accept online; please call us"),
  frequency: z.string().optional(),
  seva: z.string().trim().max(100).optional(),
  message: z.string().max(2000).default(""),
  consent: z.union([z.literal("yes"), z.literal(true)], { error: "is required" }),
  website: z.string().max(200).optional(),
  submittedFrom: z.string().max(500).default(""),
});

export type SubmitInput = z.infer<typeof submitBody>;

/** The site puts "Seva: <name>" on the first line of the message; split it out. */
export function splitSeva(input: Pick<SubmitInput, "seva" | "message">): { seva: string; message: string } {
  const message = input.message.trim();
  const match = /^Seva:\s*(.+)$/m.exec(message.split("\n")[0] ?? "");
  if (input.seva) return { seva: input.seva, message };
  if (match?.[1]) return { seva: match[1].trim(), message: message.split("\n").slice(1).join("\n").trim() };
  return { seva: DEFAULT_SEVA, message };
}
