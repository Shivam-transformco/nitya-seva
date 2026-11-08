import { collections } from "./mongo.js";

export async function ensureIndexes(): Promise<void> {
  const [users, sevaks, pledges, followups, payments, notifications, auditLogs, rateLimits, deletedItems, dueNotes] = await Promise.all([
    collections.users(),
    collections.sevaks(),
    collections.pledges(),
    collections.followups(),
    collections.payments(),
    collections.notifications(),
    collections.auditLogs(),
    collections.rateLimits(),
    collections.deletedItems(),
    collections.dueNotes(),
  ]);

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    sevaks.createIndex({ phone: 1 }, { unique: true }),
    sevaks.createIndex({ otherPhones: 1 }),
    pledges.createIndex({ status: 1, createdAt: -1 }),
    pledges.createIndex({ assignedTo: 1, status: 1 }),
    pledges.createIndex({ nextFollowUpAt: 1 }),
    pledges.createIndex({ sevakId: 1 }),
    pledges.createIndex({ legacyId: 1 }, { unique: true, sparse: true }),
    followups.createIndex({ pledgeId: 1, createdAt: -1 }),
    followups.createIndex({ byUserId: 1, createdAt: -1 }),
    payments.createIndex({ pledgeId: 1, month: 1 }),
    payments.createIndex({ month: 1 }),
    payments.createIndex({ receiptNo: 1 }, { unique: true }),
    payments.createIndex({ sevakId: 1, receivedAt: 1 }),
    dueNotes.createIndex({ pledgeId: 1, month: 1 }, { unique: true }),
    notifications.createIndex({ userId: 1, readAt: 1, createdAt: -1 }),
    auditLogs.createIndex({ entity: 1, entityId: 1, createdAt: -1 }),
    auditLogs.createIndex({ createdAt: -1 }),
    rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    deletedItems.createIndex({ deletedAt: -1 }),
    deletedItems.createIndex({ pledgeId: 1 }),
  ]);
}
