import type { ObjectId } from "mongodb";

export const ROLES = ["admin", "followup"] as const;
export type Role = (typeof ROLES)[number];

export const PLEDGE_STATUSES = ["new", "contacted", "confirmed", "paused", "cancelled", "lost"] as const;
export type PledgeStatus = (typeof PLEDGE_STATUSES)[number];

/** Statuses that still count towards the live counter. */
export const ACTIVE_PLEDGE_STATUSES: PledgeStatus[] = ["new", "contacted", "confirmed", "paused"];

export const FOLLOWUP_CHANNELS = ["call", "whatsapp", "visit", "note"] as const;
export type FollowupChannel = (typeof FOLLOWUP_CHANNELS)[number];

export const FOLLOWUP_OUTCOMES = ["reached", "no_answer", "callback", "confirmed", "declined"] as const;
export type FollowupOutcome = (typeof FOLLOWUP_OUTCOMES)[number];

export const PAYMENT_METHODS = ["upi", "cash", "bank", "cheque", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Why a pledge was marked as not genuine. Flagged pledges are left out of the counter, work lists and reports. */
export const PLEDGE_FLAGS = ["spam", "test", "duplicate", "other"] as const;
export type PledgeFlagReason = (typeof PLEDGE_FLAGS)[number];

export const NOTIFICATION_TYPES = ["pledge.new", "pledge.assigned", "followup.due"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface UserDoc {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  tokenVersion: number;
  mustChangePassword: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SevakDoc {
  _id: ObjectId;
  name: string;
  /** E.164, e.g. +919971932510 */
  phone: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PledgeDoc {
  _id: ObjectId;
  sevakId: ObjectId;
  seva: string;
  /** Whole rupees. */
  amount: number;
  frequency: "Monthly";
  status: PledgeStatus;
  assignedTo?: ObjectId;
  message: string;
  consent: boolean;
  source: { submittedFrom: string; ip?: string; userAgent?: string };
  nextFollowUpAt?: Date;
  lastContactAt?: Date;
  /** Set when staff decide this isn't a genuine pledge. */
  flag?: { reason: PledgeFlagReason; note: string; by: ObjectId; at: Date };
  /** A genuine pledge that admins have chosen not to count on the public counter. */
  hiddenFromCounter?: boolean;
  /** _id of the original document in the old `submissions` collection. */
  legacyId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowupDoc {
  _id: ObjectId;
  pledgeId: ObjectId;
  sevakId: ObjectId;
  byUserId: ObjectId;
  channel: FollowupChannel;
  outcome: FollowupOutcome;
  note: string;
  nextFollowUpAt?: Date;
  createdAt: Date;
}

export interface PaymentDoc {
  _id: ObjectId;
  pledgeId: ObjectId;
  sevakId: ObjectId;
  /** Whole rupees. */
  amount: number;
  /** "YYYY-MM" in IST: the month this payment is for. */
  month: string;
  method: PaymentMethod;
  reference: string;
  receivedAt: Date;
  recordedBy: ObjectId;
  receiptNo: string;
  createdAt: Date;
}

export interface NotificationDoc {
  _id: ObjectId;
  userId: ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  readAt?: Date;
  createdAt: Date;
}

export interface AuditLogDoc {
  _id: ObjectId;
  actorId: ObjectId | null;
  action: string;
  entity: string;
  entityId: ObjectId | null;
  data: Record<string, unknown>;
  createdAt: Date;
}

/** A manual entry added to (or, when negative, taken off) the public counter. */
export interface CounterAdjustmentDoc {
  _id: ObjectId;
  label: string;
  /** Whole rupees a month; may be negative. */
  amount: number;
  /** Sevaks to add to the count; may be negative. */
  sevaks: number;
  note: string;
  active: boolean;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CounterDoc {
  _id: string;
  seq: number;
}

export interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

/** Shape of the old `submissions` collection, read only by the migration. */
export interface LegacySubmissionDoc {
  _id: ObjectId;
  name: string;
  phone: string;
  email?: string;
  amount: string | number;
  frequency?: string;
  message?: string;
  consent?: string | boolean;
  submittedFrom?: string;
  createdAt: Date;
}
