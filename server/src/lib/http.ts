import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { badRequest } from "./errors.js";

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    const first = details[0];
    throw badRequest(first ? `${first.path || "input"}: ${first.message}` : "Invalid input.", details);
  }
  return result.data;
}

export const body = <S extends z.ZodType>(req: Request, schema: S) => parse(schema, req.body);
export const query = <S extends z.ZodType>(req: Request, schema: S) => parse(schema, req.query);

export const objectId = z
  .string()
  .refine((s) => ObjectId.isValid(s) && /^[a-f0-9]{24}$/i.test(s), "must be a valid id")
  .transform((s) => new ObjectId(s));

export function idParam(req: Request, name = "id"): ObjectId {
  return parse(objectId, req.params[name]);
}

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ ok: true, data });
}

export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}
