import type { NextFunction, Request, Response } from "express";
import { ObjectId } from "mongodb";
import type { Role } from "../domain/types.js";
import { forbidden, unauthenticated } from "../lib/errors.js";
import { SESSION_COOKIE, verifySession } from "../lib/tokens.js";
import * as usersRepo from "../modules/users/users.repository.js";

/** The logged-in staff member, as passed to services. */
export interface Actor {
  id: ObjectId;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}

declare global {
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  const claims = typeof token === "string" ? verifySession(token) : null;
  if (!claims || !ObjectId.isValid(claims.sub)) throw unauthenticated();

  const user = await usersRepo.findById(new ObjectId(claims.sub));
  if (!user || !user.active || user.tokenVersion !== claims.tv) throw unauthenticated("Your session has ended. Please log in again.");

  req.actor = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor) throw unauthenticated();
    if (!roles.includes(req.actor.role)) throw forbidden();
    next();
  };

/** For routes behind requireAuth. */
export function actorOf(req: Request): Actor {
  if (!req.actor) throw unauthenticated();
  return req.actor;
}
