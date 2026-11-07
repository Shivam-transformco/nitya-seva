import { collections } from "../../db/mongo.js";
import {
  ACTIVE_PLEDGE_STATUSES,
  PLEDGE_STATUSES,
  type MandateStatus,
  type PaymentMethod,
  type PaymentMode,
  type PledgeDoc,
  type PledgeStatus,
} from "../../domain/types.js";
import { endOfIstDay, istMonth } from "../../lib/dates.js";
import { notFlagged } from "../counter/counter.rules.js";
import * as sevaksRepo from "../sevaks/sevaks.repository.js";
import * as usersRepo from "../users/users.repository.js";
import * as pledgesRepo from "../pledges/pledges.repository.js";

export async function summary() {
  const [pledges, payments] = await Promise.all([collections.pledges(), collections.payments()]);
  const [byStatus, unassigned, due, flagged, thisMonth] = await Promise.all([
    pledges
      .aggregate<{ _id: PledgeStatus; count: number; amount: number }>([
        { $match: notFlagged },
        { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      ])
      .toArray(),
    pledges.countDocuments({ ...notFlagged, assignedTo: { $exists: false }, status: { $in: ["new", "contacted"] } }),
    pledges.countDocuments({ ...notFlagged, nextFollowUpAt: { $lte: endOfIstDay() } }),
    pledges.countDocuments({ flag: { $exists: true } }),
    payments
      .aggregate<{ amount: number; count: number }>([
        { $match: { month: istMonth() } },
        { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const statuses = Object.fromEntries(PLEDGE_STATUSES.map((s) => [s, { count: 0, amount: 0 }])) as Record<
    PledgeStatus,
    { count: number; amount: number }
  >;
  for (const row of byStatus) statuses[row._id] = { count: row.count, amount: row.amount };

  return {
    statuses,
    /** Monthly amount from confirmed sevaks: what the temple can expect each month. */
    committedMonthly: statuses.confirmed.amount,
    unassigned,
    followupsDue: due,
    flagged,
    collectedThisMonth: { month: istMonth(), amount: thisMonth[0]?.amount ?? 0, payments: thisMonth[0]?.count ?? 0 },
  };
}

export async function monthlyCollections(from: string, to: string) {
  const payments = await collections.payments();
  return payments
    .aggregate<{ month: string; amount: number; payments: number; sevaks: number }>([
      { $match: { month: { $gte: from, $lte: to } } },
      { $group: { _id: "$month", amount: { $sum: "$amount" }, payments: { $sum: 1 }, sevaks: { $addToSet: "$sevakId" } } },
      { $project: { _id: 0, month: "$_id", amount: 1, payments: 1, sevaks: { $size: "$sevaks" } } },
      { $sort: { month: 1 } },
    ])
    .toArray();
}

/** How confirmed sevaks pay, and what was collected through each method. */
export async function paymentModes(from: string, to: string) {
  const [pledges, payments] = await Promise.all([collections.pledges(), collections.payments()]);
  const [modes, methods] = await Promise.all([
    pledges
      .aggregate<{ mode: PaymentMode | null; mandate: MandateStatus | null; count: number; amount: number }>([
        { $match: { ...notFlagged, status: { $in: ["confirmed", "paused"] } } },
        {
          $group: {
            _id: { mode: "$paymentSetup.mode", mandate: "$paymentSetup.mandate.status" },
            count: { $sum: 1 },
            amount: { $sum: "$amount" },
          },
        },
        { $project: { _id: 0, mode: { $ifNull: ["$_id.mode", null] }, mandate: { $ifNull: ["$_id.mandate", null] }, count: 1, amount: 1 } },
        { $sort: { amount: -1 } },
      ])
      .toArray(),
    payments
      .aggregate<{ method: PaymentMethod; amount: number; payments: number }>([
        { $match: { month: { $gte: from, $lte: to } } },
        { $group: { _id: "$method", amount: { $sum: "$amount" }, payments: { $sum: 1 } } },
        { $project: { _id: 0, method: "$_id", amount: 1, payments: 1 } },
        { $sort: { amount: -1 } },
      ])
      .toArray(),
  ]);
  return { modes, methods };
}

export async function activity(from: Date, to: Date) {
  const [followups, users] = await Promise.all([collections.followups(), usersRepo.list()]);
  const rows = await followups
    .aggregate<{ _id: unknown; total: number; reached: number; confirmed: number; noAnswer: number }>([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$byUserId",
          total: { $sum: 1 },
          reached: { $sum: { $cond: [{ $in: ["$outcome", ["reached", "callback", "confirmed", "declined"]] }, 1, 0] } },
          confirmed: { $sum: { $cond: [{ $eq: ["$outcome", "confirmed"] }, 1, 0] } },
          noAnswer: { $sum: { $cond: [{ $eq: ["$outcome", "no_answer"] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  return users
    .filter((u) => u.active || byId.has(u._id.toHexString()))
    .map((u) => {
      const r = byId.get(u._id.toHexString());
      return {
        userId: u._id,
        name: u.name,
        role: u.role,
        followups: r?.total ?? 0,
        reached: r?.reached ?? 0,
        confirmed: r?.confirmed ?? 0,
        noAnswer: r?.noAnswer ?? 0,
      };
    })
    .sort((a, b) => b.followups - a.followups);
}

const csvCell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : String(v ?? "");
  // Leading = + - @ would be run as a formula by spreadsheet apps.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function* pledgesCsv(): AsyncGenerator<string> {
  const users = new Map((await usersRepo.list()).map((u) => [u._id.toHexString(), u.name]));
  yield [
    "Created",
    "Name",
    "Phone",
    "Email",
    "Seva",
    "Amount",
    "Status",
    "Assigned to",
    "Last contact",
    "Next follow-up",
    "Message",
    "Marked as",
    "On public counter",
    "Pays by",
    "Mandate status",
    "Mandate bank",
    "Mandate reference",
    "Debit day",
  ]
    .map(csvCell)
    .join(",") + "\n";

  let batch: PledgeDoc[] = [];
  const flush = async function* () {
    const sevaks = await sevaksRepo.findByIds(batch.map((p) => p.sevakId));
    for (const p of batch) {
      const s = sevaks.get(p.sevakId.toHexString());
      yield [
        p.createdAt,
        s?.name,
        s?.phone,
        s?.email,
        p.seva,
        p.amount,
        p.status,
        p.assignedTo ? users.get(p.assignedTo.toHexString()) : "",
        p.lastContactAt ?? "",
        p.nextFollowUpAt ?? "",
        p.message,
        p.flag?.reason ?? "",
        !p.flag && !p.hiddenFromCounter && ACTIVE_PLEDGE_STATUSES.includes(p.status) ? "yes" : "no",
        p.paymentSetup?.mode ?? "",
        p.paymentSetup?.mandate?.status ?? "",
        p.paymentSetup?.mandate?.bank ?? "",
        p.paymentSetup?.mandate?.reference ?? "",
        p.paymentSetup?.mandate?.debitDay ?? "",
      ]
        .map(csvCell)
        .join(",") + "\n";
    }
    batch = [];
  };

  for await (const p of pledgesRepo.iterate({})) {
    batch.push(p);
    if (batch.length >= 200) yield* flush();
  }
  yield* flush();
}
