import type { ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";
import { badRequest, notFound } from "../../lib/errors.js";
import type { Actor } from "../../middleware/auth.js";
import * as audit from "../audit/audit.service.js";
import * as repo from "./sevaks.repository.js";

export async function search(text: string) {
  const sevaks = await repo.search(text);
  const counts = await (await collections.pledges())
    .aggregate<{ _id: ObjectId; pledges: number }>([
      { $match: { sevakId: { $in: sevaks.map((s) => s._id) } } },
      { $group: { _id: "$sevakId", pledges: { $sum: 1 } } },
    ])
    .toArray();
  const byId = new Map(counts.map((c) => [c._id.toHexString(), c.pledges]));
  return sevaks.map((s) => ({
    _id: s._id,
    name: s.name,
    phone: s.phone,
    email: s.email,
    otherPhones: s.otherPhones ?? [],
    pledges: byId.get(s._id.toHexString()) ?? 0,
  }));
}

/**
 * One person recorded twice (two phone numbers, or a typo). Everything of `fromId` moves to `intoId`;
 * its phone stays searchable on the kept sevak, and the removed record is kept in the audit log.
 */
export async function merge(actor: Actor, intoId: ObjectId, fromId: ObjectId) {
  if (intoId.equals(fromId)) throw badRequest("Choose a different sevak to merge in.");
  const [into, from] = await Promise.all([repo.findById(intoId), repo.findById(fromId)]);
  if (!into || !from) throw notFound("Sevak");

  const moved = { sevakId: intoId };
  const [pledges, followups, payments, deletedItems, dueNotes] = await Promise.all([
    collections.pledges(),
    collections.followups(),
    collections.payments(),
    collections.deletedItems(),
    collections.dueNotes(),
  ]);
  const [p, f, pay] = await Promise.all([
    pledges.updateMany({ sevakId: fromId }, { $set: moved }),
    followups.updateMany({ sevakId: fromId }, { $set: moved }),
    payments.updateMany({ sevakId: fromId }, { $set: moved }),
    deletedItems.updateMany({ sevakId: fromId }, { $set: moved }),
    dueNotes.updateMany({ sevakId: fromId }, { $set: moved }),
  ]);

  const otherPhones = [...new Set([...(into.otherPhones ?? []), from.phone, ...(from.otherPhones ?? [])])].filter((n) => n !== into.phone);
  await repo.remove(fromId);
  await repo.update(intoId, { otherPhones, ...(into.email ? {} : { email: from.email }) });
  await audit.record(actor.id, "sevak.merge", "sevak", intoId, {
    merged: from,
    moved: { pledges: p.modifiedCount, followups: f.modifiedCount, payments: pay.modifiedCount },
  });
  return { pledges: p.modifiedCount };
}
