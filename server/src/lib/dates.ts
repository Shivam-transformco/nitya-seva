const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** "YYYY-MM" for the given instant, in India time. */
export function istMonth(date = new Date()): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7);
}

/** Today's month and day of the month, in India time. */
export function istToday(date = new Date()): { month: string; day: number } {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return { month: ist.toISOString().slice(0, 7), day: ist.getUTCDate() };
}

/** End of the current day in India time, as a UTC Date. */
export function endOfIstDay(date = new Date()): Date {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(23, 59, 59, 999);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "YYYY-MM" plus `n` months (n may be negative). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

/** Whole months from `from` to `to` (negative when `to` is earlier). */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  return ty * 12 + tm - (fy * 12 + fm);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Indian financial year starting in April of `startYear` (2025 = April 2025 to March 2026),
 * as UTC instants bounding it in India time.
 */
export function financialYear(startYear: number): { from: Date; to: Date; label: string } {
  return {
    from: new Date(Date.UTC(startYear, 3, 1) - IST_OFFSET_MS),
    to: new Date(Date.UTC(startYear + 1, 3, 1) - IST_OFFSET_MS - 1),
    label: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
  };
}

/** The financial year (by its starting year) that an instant falls in. */
export function financialYearOf(date = new Date()): number {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
}
