export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError("VALIDATION", message, details);
export const unauthenticated = (message = "Please log in.") => new AppError("UNAUTHENTICATED", message);
export const forbidden = (message = "You don't have access to this.") => new AppError("FORBIDDEN", message);
export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found.`);
export const conflict = (message: string) => new AppError("CONFLICT", message);
export const rateLimited = (message = "Too many requests. Please try again later.") =>
  new AppError("RATE_LIMITED", message);
