import type { ObjectId } from "mongodb";
import type { z } from "zod";
import { canManageRole, permissionsFor, type Permission } from "../../domain/permissions.js";
import type { UserDoc } from "../../domain/types.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { hashPassword } from "../../lib/passwords.js";
import type { Actor } from "../../middleware/auth.js";
import * as audit from "../audit/audit.service.js";
import * as repo from "./users.repository.js";
import type { createUserBody, updateUserBody } from "./users.schema.js";

export type PublicUser = Omit<UserDoc, "passwordHash" | "tokenVersion"> & { permissions: Permission[] };

export function toPublic({ passwordHash: _p, tokenVersion: _t, ...rest }: UserDoc): PublicUser {
  return { ...rest, permissions: permissionsFor(rest.role) };
}

export async function list(): Promise<PublicUser[]> {
  return (await repo.list()).map(toPublic);
}

/** `actor` is null only for the command-line scripts that create the first owner. */
export async function create(actor: Actor | null, input: z.infer<typeof createUserBody>): Promise<PublicUser> {
  if (actor && !canManageRole(actor.role, input.role)) throw forbidden(`You can't add someone as ${input.role}.`);
  const user = await repo.insert({
    name: input.name,
    email: input.email,
    role: input.role,
    passwordHash: await hashPassword(input.temporaryPassword),
    active: true,
    tokenVersion: 0,
    mustChangePassword: true,
  });
  await audit.record(actor?.id ?? null, "user.create", "user", user._id, { email: user.email, role: user.role });
  return toPublic(user);
}

export async function update(actor: Actor, id: ObjectId, input: z.infer<typeof updateUserBody>): Promise<PublicUser> {
  const existing = await repo.findById(id);
  if (!existing) throw notFound("Staff account");
  const self = existing._id.equals(actor.id);
  if (self && (input.active === false || (input.role && input.role !== existing.role))) {
    throw badRequest("You can't deactivate yourself or change your own role.");
  }
  if (!self && !canManageRole(actor.role, existing.role)) throw forbidden(`Only an owner can change a ${existing.role}'s account.`);
  if (input.role && !canManageRole(actor.role, input.role)) throw forbidden(`You can't make someone ${input.role}.`);
  const losingOwner = existing.role === "owner" && existing.active && (input.active === false || (input.role && input.role !== "owner"));
  if (losingOwner && (await repo.countActiveByRole("owner")) <= 1) throw badRequest("There must always be at least one active owner.");

  const set: Partial<UserDoc> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.role !== undefined) set.role = input.role;
  if (input.active !== undefined) set.active = input.active;
  if (input.resetPassword !== undefined) {
    set.passwordHash = await hashPassword(input.resetPassword);
    set.mustChangePassword = true;
  }
  // Any change to access or credentials ends the user's existing sessions.
  const revoke = input.active === false || input.role !== undefined || input.resetPassword !== undefined;

  const updated = await repo.update(id, set, revoke);
  if (!updated) throw notFound("Staff account");
  await audit.record(actor.id, "user.update", "user", id, {
    fields: Object.keys(input).map((k) => (k === "resetPassword" ? "password" : k)),
    ...(input.role ? { role: { from: existing.role, to: input.role } } : {}),
  });
  return toPublic(updated);
}
