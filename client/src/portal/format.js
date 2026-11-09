export { formatINR } from "../content";

const TZ = "Asia/Kolkata";

export const STATUS_LABELS = {
  new: "New",
  contacted: "Contacted",
  confirmed: "Confirmed",
  paused: "Paused",
  cancelled: "Cancelled",
  lost: "Lost",
};
export const STATUSES = Object.keys(STATUS_LABELS);

export const OUTCOME_LABELS = {
  reached: "Spoke with them",
  no_answer: "No answer",
  callback: "Call back later",
  confirmed: "Confirmed seva",
  declined: "Declined",
};

export const CHANNEL_LABELS = { call: "Phone call", whatsapp: "WhatsApp", visit: "In person", note: "Note" };

export const METHOD_LABELS = {
  ecs: "ECS auto-debit",
  upi_autopay: "UPI AutoPay",
  upi: "UPI",
  cash: "Cash",
  bank: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

export const MODE_LABELS = { ecs: "ECS / NACH auto-debit", upi_autopay: "UPI AutoPay", manual: "Pays each month" };
export const MODE_SHORT = { ecs: "ECS", upi_autopay: "AutoPay", manual: "Pays monthly" };
export const AUTO_DEBIT_MODES = ["ecs", "upi_autopay"];

export const MANDATE_LABELS = {
  submitted: "Form submitted",
  active: "Active",
  rejected: "Rejected by bank",
  cancelled: "Cancelled",
};

/** The payment method to suggest for a pledge, from how the sevak pays. */
export const defaultMethod = (setup) => (setup && AUTO_DEBIT_MODES.includes(setup.mode) ? setup.mode : "upi");

export const FLAG_LABELS = { spam: "Spam", test: "Test entry", duplicate: "Duplicate", other: "Other" };

export const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  accounts: "Accounts",
  viewer: "Viewer",
  followup: "Follow-up devotee",
};
export const ROLES = Object.keys(ROLE_LABELS);

/** Mirrors the server's role table, so the portal only offers what someone may change. */
const MANAGES = { owner: ROLES, admin: ["accounts", "viewer", "followup"] };
export const manageableRoles = (role) => MANAGES[role] ?? [];

/** The server sends each signed-in user's permissions; it still checks every request itself. */
export const can = (user, permission) => Boolean(user?.permissions?.includes(permission));

export const ORIGIN_LABELS = {
  website: "Website",
  legacy: "Old website form",
  pre_website: "Before the website",
  google_form: "Google Form",
  staff: "Added by staff",
};
/** Origins staff can choose when adding a pledge by hand. */
export const MANUAL_ORIGINS = ["pre_website", "google_form", "staff"];

export const FREQUENCIES = ["Monthly", "Quarterly", "Half-yearly", "Yearly", "One-time"];
const PER = { Monthly: "/mo", Quarterly: "/qtr", "Half-yearly": "/6 mo", Yearly: "/yr", "One-time": " once" };
export const perLabel = (frequency) => PER[frequency] ?? "/mo";
const MONTHS_PER_GIFT = { Monthly: 1, Quarterly: 3, "Half-yearly": 6, Yearly: 12 };
export const monthsBetweenGifts = (frequency) => MONTHS_PER_GIFT[frequency] ?? null;

/** Why a month's gift didn't come; mirrors the server's list. */
export const DUE_REASON_LABELS = {
  travelling: "Travelling",
  financial: "Money is tight",
  bank_failure: "Bank debit failed",
  pay_later: "Will pay later",
  unreachable: "Couldn't reach them",
  forgot: "Forgot",
  other: "Other",
};

/** What happened to a month's gift. */
export const DUE_STATE_LABELS = {
  paid: "Paid",
  partial: "Part paid",
  excused: "Excused",
  paused: "Paused",
  due: "Still to come",
  overdue: "Overdue",
  missed: "Missed",
};
export const OWING_STATES = ["partial", "overdue", "missed"];

/** "2025-26" for the financial year starting April `fy`. */
export const fyLabel = (fy) => `${fy}-${String((fy + 1) % 100).padStart(2, "0")}`;
export const currentFy = () => {
  const [y, m] = currentMonth().split("-").map(Number);
  return m >= 4 ? y : y - 1;
};

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : "—";

export const formatDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: TZ,
      })
    : "—";

const istDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });

/** "Overdue", "Today", "Tomorrow" or a date, for a next follow-up timestamp. */
export function dueLabel(d) {
  if (!d) return null;
  const day = istDay(d);
  const today = istDay(Date.now());
  const tomorrow = istDay(Date.now() + 86_400_000);
  if (day < today) return { text: `Overdue · ${formatDate(d)}`, tone: "late" };
  if (day === today) return { text: "Due today", tone: "today" };
  if (day === tomorrow) return { text: "Tomorrow", tone: "soon" };
  return { text: formatDate(d), tone: "later" };
}

/** "YYYY-MM" for the current month in IST, matching how the server stores payment months. */
export const currentMonth = () => monthOf(new Date());

/** "YYYY-MM" an instant falls in, in IST. */
export const monthOf = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date(d));

/** "YYYY-MM" plus `n` months. */
export function addMonthsTo(month, n) {
  const [y, m] = month.split("-").map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

export const monthLabel = (m) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Payment overdue", "3 payments missed" or "Sep 2026 not paid" for a pledge's unpaid months (oldest first). */
export function unpaidLabel(missedInRow, unpaid) {
  if (!unpaid?.length) return "";
  if (missedInRow === unpaid.length) return missedInRow === 1 ? "Payment overdue" : `${missedInRow} payments missed`;
  return unpaid.length === 1 ? `${monthLabel(unpaid[0])} not paid` : `${unpaid.length} payments missed`;
}

/** Value for <input type="date"> (today, in the browser's timezone). */
export const todayInput = () => new Date().toLocaleDateString("en-CA");

export const telLink = (phone) => `tel:${phone}`;
export const waLink = (phone, text) =>
  `https://wa.me/${phone.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export function temporaryPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
