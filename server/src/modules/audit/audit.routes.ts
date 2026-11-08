import { Router } from "express";
import type { Filter } from "mongodb";
import { z } from "zod";
import { collections } from "../../db/mongo.js";
import type { AuditLogDoc } from "../../domain/types.js";
import { ok, pagination, query } from "../../lib/http.js";
import * as usersRepo from "../users/users.repository.js";

const listAuditQuery = pagination.extend({ action: z.string().trim().max(60).optional() });

/** Mounted at /api/audit behind `audit.view`. Newest first; `action` matches a prefix like "pledge." or "user.". */
export const auditRouter = Router();

auditRouter.get("/", async (req, res) => {
  const q = query(req, listAuditQuery);
  const filter: Filter<AuditLogDoc> = q.action
    ? { action: { $regex: `^${q.action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } }
    : {};
  const col = await collections.auditLogs();
  const [items, total, users] = await Promise.all([
    col.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).toArray(),
    col.countDocuments(filter),
    usersRepo.list(),
  ]);
  const names = new Map(users.map((u) => [u._id.toHexString(), u.name]));
  ok(res, {
    items: items.map((a) => ({
      _id: a._id,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      actorName: a.actorId ? (names.get(a.actorId.toHexString()) ?? "Unknown") : "Website",
      data: a.data,
      createdAt: a.createdAt,
    })),
    total,
    page: q.page,
    limit: q.limit,
  });
});
