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

export const ROLE_LABELS = { admin: "Admin", followup: "Follow-up devotee" };

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
export const currentMonth = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date());

export const monthLabel = (m) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

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
