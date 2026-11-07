import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { Role } from "../domain/types.js";

export const SESSION_COOKIE = "ns_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface SessionClaims {
  sub: string;
  role: Role;
  /** Must equal the user's current tokenVersion, otherwise the session was revoked. */
  tv: number;
}

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, env().JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS, algorithm: "HS256" });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    const decoded = jwt.verify(token, env().JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof decoded !== "object" || typeof decoded.sub !== "string") return null;
    return { sub: decoded.sub, role: decoded.role as Role, tv: Number(decoded.tv) };
  } catch {
    return null;
  }
}
