import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ ok: false, error: `No route for ${req.method} ${req.path}.`, code: "NOT_FOUND" });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ ok: false, error: err.message, code: err.code, details: err.details });
    return;
  }
  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ ok: false, error: "Request body is not valid JSON.", code: "VALIDATION" });
    return;
  }
  if (typeof err === "object" && err && "type" in err && err.type === "entity.too.large") {
    res.status(413).json({ ok: false, error: "Request body is too large.", code: "VALIDATION" });
    return;
  }

  console.error(`[${req.method} ${req.path}]`, err);
  res.status(500).json({ ok: false, error: "Server error. Please try again.", code: "INTERNAL" });
}
