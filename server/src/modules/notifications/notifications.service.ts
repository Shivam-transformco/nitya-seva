import type { ObjectId } from "mongodb";
import type { PledgeDoc, SevakDoc } from "../../domain/types.js";
import { notFound } from "../../lib/errors.js";
import * as usersRepo from "../users/users.repository.js";
import * as repo from "./notifications.repository.js";

// Single place that decides who hears about what. Add email/WhatsApp delivery here later.

const pledgeLink = (pledgeId: ObjectId) => `/pledges/${pledgeId.toHexString()}`;

export async function pledgeCreated(pledge: PledgeDoc, sevak: SevakDoc): Promise<void> {
  const admins = await usersRepo.listActiveByRole("admin");
  await repo.insertMany(
    admins.map((a) => ({
      userId: a._id,
      type: "pledge.new" as const,
      title: "New Nitya Sevak pledge",
      body: `${sevak.name} pledged ₹${pledge.amount.toLocaleString("en-IN")} a month for ${pledge.seva}.`,
      link: pledgeLink(pledge._id),
    })),
  );
}

export async function pledgeAssigned(pledge: PledgeDoc, sevak: SevakDoc, assigneeId: ObjectId): Promise<void> {
  await repo.insertMany([
    {
      userId: assigneeId,
      type: "pledge.assigned",
      title: "A sevak has been assigned to you",
      body: `Please call ${sevak.name} about their ₹${pledge.amount.toLocaleString("en-IN")} monthly seva.`,
      link: pledgeLink(pledge._id),
    },
  ]);
}

export async function followupDue(pledge: PledgeDoc, sevak: SevakDoc): Promise<boolean> {
  if (!pledge.assignedTo) return false;
  const link = pledgeLink(pledge._id);
  if (await repo.hasUnread(pledge.assignedTo, "followup.due", link)) return false;
  await repo.insertMany([
    { userId: pledge.assignedTo, type: "followup.due", title: "Follow-up due", body: `Time to follow up with ${sevak.name}.`, link },
  ]);
  return true;
}

export const list = (userId: ObjectId, opts: { unreadOnly: boolean; page: number; limit: number }) =>
  repo.listForUser(userId, { unreadOnly: opts.unreadOnly, skip: (opts.page - 1) * opts.limit, limit: opts.limit });

export async function markRead(userId: ObjectId, id: ObjectId): Promise<void> {
  if (!(await repo.markRead(userId, id))) throw notFound("Notification");
}

export const markAllRead = (userId: ObjectId) => repo.markAllRead(userId);
