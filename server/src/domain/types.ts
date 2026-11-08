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

export const PAYMENT_METHODS = ["upi", "cash", "bank", "cheque", "other", "ecs", "upi_autopay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** How a sevak has arranged to give each month. */
export const PAYMENT_MODES = ["ecs", "upi_autopay", "manual"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
/** Modes where the bank debits the sevak against a signed mandate. */
export const AUTO_DEBIT_MODES: readonly PaymentMode[] = ["ecs", "upi_autopay"];

export const MANDATE_STATUSES = ["submitted", "active", "rejected", "cancelled"] as const;
export type MandateStatus = (typeof MANDATE_STATUSES)[number];

export interface PaymentSetup {
  mode: PaymentMode;
  /** Only for auto-debit modes. Account numbers are deliberately not stored. */
  mandate?: {
    status: MandateStatus;
    bank: string;
    /** UMRN or the bank's mandate reference. */
    reference: string;
    /** Day of the month the debit is due, 1–31. */
    debitDay?: number;
    /** "YYYY-MM": first month the mandate debits. */
    startMonth?: string;
  };
  note: string;
  updatedBy: ObjectId;
  updatedAt: Date;
}

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
  /** How they pay (ECS, UPI AutoPay or each month by hand). Unset until staff record it. */
  paymentSetup?: PaymentSetup;
  /** The most recent status change, kept so a misclick can be undone. Cleared by the undo. */
  lastStatusChange?: StatusChange;
  /** _id of the original document in the old `submissions` collection. */
  legacyId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface StatusChange {
  from: PledgeStatus;
  to: PledgeStatus;
  by: ObjectId;
  at: Date;
  /** Set when logging this follow-up made the change. */
  followupId?: ObjectId;
  /** The next follow-up before the change; closing a pledge clears it. */
  nextFollowUpAt?: Date;
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
  /** The pledge's contact dates just before this was logged, restored if it's deleted while still the latest. */
  before?: { lastContactAt?: Date; nextFollowUpAt?: Date };
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

/** Settings for the public counter; a single document with `_id: "counter"`. */
export interface CounterSettingsDoc {
  _id: "counter";
  /** Monthly goal in whole rupees, shown as "Raised of ₹…". */
  target: number;
  updatedBy: ObjectId;
  updatedAt: Date;
}

export const DELETED_KINDS = ["pledge", "followup", "payment"] as const;
export type DeletedKind = (typeof DELETED_KINDS)[number];

/**
 * Something staff deleted, moved here whole so it can be restored. A deleted pledge carries its
 * follow-ups and payments with it; the live collections never see deleted documents.
 */
export interface DeletedItemDoc {
  _id: ObjectId;
  kind: DeletedKind;
  /** _id of the deleted pledge, follow-up or payment. */
  itemId: ObjectId;
  pledgeId: ObjectId;
  sevakId: ObjectId;
  reason: string;
  pledge?: PledgeDoc;
  followups: FollowupDoc[];
  payments: PaymentDoc[];
  deletedBy: ObjectId;
  deletedAt: Date;
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
