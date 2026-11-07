import type { ObjectId } from "mongodb";
import { badRequest, unauthenticated } from "../../lib/errors.js";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../../lib/passwords.js";
import { consume } from "../../lib/rateLimit.js";
import { signSession } from "../../lib/tokens.js";
import * as audit from "../audit/audit.service.js";
import * as usersRepo from "../users/users.repository.js";
import { toPublic, type PublicUser } from "../users/users.service.js";

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;

export async function login(email: string, password: string, ip: string): Promise<{ token: string; user: PublicUser }> {
  const normalized = email.toLowerCase();
  await Promise.all([
    consume("login-ip", ip, LOGIN_LIMIT, LOGIN_WINDOW_SECONDS),
    consume("login-email", normalized, LOGIN_LIMIT, LOGIN_WINDOW_SECONDS),
  ]);

  const user = await usersRepo.findByEmail(normalized);
  const valid = user ? await verifyPassword(password, user.passwordHash) : await burnPasswordCheck(password);
  if (!user || !valid || !user.active) throw unauthenticated("Incorrect email or password.");

  const updated = (await usersRepo.update(user._id, { lastLoginAt: new Date() })) ?? user;
  await audit.record(user._id, "auth.login", "user", user._id, { ip });
  return { token: signSession({ sub: user._id.toHexString(), role: user.role, tv: updated.tokenVersion }), user: toPublic(updated) };
}

export async function changePassword(
  userId: ObjectId,
  currentPassword: string,
  newPassword: string,
): Promise<{ token: string; user: PublicUser }> {
  const user = await usersRepo.findById(userId);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw badRequest("Current password is incorrect.");
  }
  if (currentPassword === newPassword) throw badRequest("New password must be different.");

  const updated = await usersRepo.update(
    userId,
    { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    true,
  );
  if (!updated) throw unauthenticated();
  await audit.record(userId, "auth.password_change", "user", userId);
  // Other sessions are revoked by the tokenVersion bump; this one gets a fresh token.
  return { token: signSession({ sub: userId.toHexString(), role: updated.role, tv: updated.tokenVersion }), user: toPublic(updated) };
}

export async function me(userId: ObjectId): Promise<PublicUser> {
  const user = await usersRepo.findById(userId);
  if (!user) throw unauthenticated();
  return toPublic(user);
}
