/** "YYYY-MM" months from `from` to `to` inclusive, every `step` months. */
export function monthsInRange(from: string, to: string, step = 1): string[] {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  const out: string[] = [];
  for (let i = fy * 12 + fm - 1; i <= ty * 12 + tm - 1; i += step) {
    out.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}

/** When a past payment is taken to have arrived: noon IST on the 1st of its month, or now for the current month. */
export function receivedAtForMonth(month: string, now = new Date()): Date {
  const at = new Date(`${month}-01T12:00:00+05:30`);
  return at.getTime() > now.getTime() ? now : at;
}
