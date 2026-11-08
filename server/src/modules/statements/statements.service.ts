import type { ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";
import { financialYear } from "../../lib/dates.js";
import { notFound } from "../../lib/errors.js";
import * as sevaksRepo from "../sevaks/sevaks.repository.js";

/** Everyone who gave in the financial year (by the date the money came), with their totals. */
export async function list(fy: number, q?: string) {
  const { from, to, label } = financialYear(fy);
  const match: Record<string, unknown> = { receivedAt: { $gte: from, $lte: to } };
  if (q) match.sevakId = { $in: await sevaksRepo.searchIds(q) };
  const rows = await (await collections.payments())
    .aggregate<{ _id: ObjectId; amount: number; payments: number; last: Date }>([
      { $match: match },
      { $group: { _id: "$sevakId", amount: { $sum: "$amount" }, payments: { $sum: 1 }, last: { $max: "$receivedAt" } } },
      { $sort: { amount: -1 } },
    ])
    .toArray();
  const sevaks = await sevaksRepo.findByIds(rows.map((r) => r._id));
  return {
    fy,
    label,
    total: rows.reduce((s, r) => s + r.amount, 0),
    sevaks: rows.map((r) => {
      const s = sevaks.get(r._id.toHexString());
      return { sevakId: r._id, name: s?.name ?? "Unknown", phone: s?.phone ?? "", amount: r.amount, payments: r.payments, lastReceivedAt: r.last };
    }),
  };
}

/** One sevak's payments in the financial year, for a printable statement. */
export async function forSevak(sevakId: ObjectId, fy: number) {
  const sevak = await sevaksRepo.findById(sevakId);
  if (!sevak) throw notFound("Sevak");
  const { from, to, label } = financialYear(fy);
  const payments = await (await collections.payments()).find({ sevakId, receivedAt: { $gte: from, $lte: to } }).sort({ receivedAt: 1 }).toArray();
  const pledges = await (await collections.pledges()).find({ _id: { $in: payments.map((p) => p.pledgeId) } }, { projection: { seva: 1 } }).toArray();
  const sevaOf = new Map(pledges.map((p) => [p._id.toHexString(), p.seva]));
  return {
    fy,
    label,
    from,
    to,
    sevak: { _id: sevak._id, name: sevak.name, phone: sevak.phone, email: sevak.email },
    payments: payments.map((p) => ({
      _id: p._id,
      receiptNo: p.receiptNo,
      receivedAt: p.receivedAt,
      month: p.month,
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      seva: sevaOf.get(p.pledgeId.toHexString()) ?? "",
    })),
    total: payments.reduce((s, p) => s + p.amount, 0),
  };
}
