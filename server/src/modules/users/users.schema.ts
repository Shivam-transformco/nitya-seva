import { z } from "zod";
import { ROLES } from "../../domain/types.js";
import { MIN_PASSWORD_LENGTH } from "../../lib/passwords.js";

export const password = z.string().min(MIN_PASSWORD_LENGTH, `must be at least ${MIN_PASSWORD_LENGTH} characters`).max(200);

export const createUserBody = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(200),
  role: z.enum(ROLES),
  temporaryPassword: password,
});

export const updateUserBody = z
  .object({
    name: z.string().trim().min(1).max(100),
    role: z.enum(ROLES),
    active: z.boolean(),
    resetPassword: password,
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, "nothing to update");
