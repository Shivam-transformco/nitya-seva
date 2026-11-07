const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** "YYYY-MM" for the given instant, in India time. */
export function istMonth(date = new Date()): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7);
}

/** End of the current day in India time, as a UTC Date. */
export function endOfIstDay(date = new Date()): Date {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(23, 59, 59, 999);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
