import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  MONGO_DB: z.string().min(1).default("nityaseva"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ALLOWED_ORIGINS: z
    .string()
    .default("https://nityaseva.iskconjiasarai.com,http://localhost:5173")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  CRON_SECRET: z.string().min(16).optional(),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${problems}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";
