import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { addMonths, daysInMonth, financialYear, financialYearOf, monthsBetween } from "../src/lib/dates.js";
import { scheduleAfter, scheduleUpdate } from "../src/modules/pledges/pledges.rules.js";
import { amountFor, dueDayOf, ledger, missedInRow, owedIn, scheduleFromHistory, totalsFor, unpaidMonths, type LedgerPledge } from "../src/modules/dues/dues.rules.js";

const pledge = (p: Partial<LedgerPledge> = {}): LedgerPledge => ({
  amount: 1000,
  frequency: "Monthly",
  status: "confirmed",
  dueFrom: "2026-01",
  createdAt: new Date("2026-01-05"),
  updatedAt: new Date("2026-01-05"),
  ...p,
});
const today = { month: "2026-04", day: 10 };
const all = { from: "2025-01", to: "2026-12" };
const states = (rows: { month: string; state: string }[]) => rows.map((r) => `${r.month}:${r.state}`);

describe("month helpers", () => {
  it("adds and counts months across years", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthsBetween("2025-11", "2026-02")).toBe(3);
    expect(daysInMonth("2028-02")).toBe(29);
  });

  it("knows the Indian financial year", () => {
    expect(financialYear(2025).label).toBe("2025-26");
    expect(financialYearOf(new Date("2026-03-31T12:00:00Z"))).toBe(2025);
    // 1 April 00:30 in India is still 31 March in UTC.
    expect(financialYearOf(new Date("2026-03-31T19:00:00Z"))).toBe(2026);
  });
});

describe("scheduleAfter", () => {
  it("starts dues when confirmed, from giving-since if known", () => {
    expect(scheduleAfter({}, "confirmed", "2026-04")).toEqual({ dueFrom: "2026-04", pauses: [] });
    expect(scheduleAfter({ givingSince: "2024-06" }, "confirmed", "2026-04").dueFrom).toBe("2024-06");
  });

  it("opens a pause, and closes it on resuming", () => {
    const paused = scheduleAfter({ dueFrom: "2026-01" }, "paused", "2026-03");
    expect(paused.pauses).toEqual([{ from: "2026-03" }]);
    expect(scheduleAfter(paused, "confirmed", "2026-06").pauses).toEqual([{ from: "2026-03", to: "2026-05" }]);
    // Paused and resumed in the same month: no pause at all.
    expect(scheduleAfter(paused, "confirmed", "2026-03").pauses).toEqual([]);
  });

  it("stops dues on cancelling, and counts the gap as a pause on coming back", () => {
    const cancelled = scheduleAfter({ dueFrom: "2026-01" }, "cancelled", "2026-03");
    expect(cancelled.stoppedFrom).toBe("2026-03");
    const back = scheduleAfter(cancelled, "confirmed", "2026-07");
    expect(back).toEqual({ dueFrom: "2026-01", pauses: [{ from: "2026-03", to: "2026-06" }] });
    expect(scheduleUpdate(back).unset).toContain("stoppedFrom");
  });

  it("clears the schedule for statuses with nothing due", () => {
    expect(scheduleUpdate(scheduleAfter({ dueFrom: "2026-01" }, "contacted", "2026-03"))).toEqual({
      set: {},
      unset: ["dueFrom", "pauses", "stoppedFrom"],
    });
  });
});

describe("ledger", () => {
  it("marks paid, missed and this month's state by the due day", () => {
    const rows = ledger(pledge(), [{ month: "2026-01", amount: 1000 }, { month: "2026-03", amount: 400 }], new Map(), all, today);
    // No due day: the month end, so on the 10th it's still to come.
    expect(states(rows)).toEqual(["2026-01:paid", "2026-02:missed", "2026-03:partial", "2026-04:due"]);
    expect(states(ledger(pledge({ dueDay: 5 }), [], new Map(), all, today)).at(-1)).toBe("2026-04:overdue");
    expect(states(ledger(pledge({ dueDay: 10 }), [], new Map(), all, today)).at(-1)).toBe("2026-04:due");
  });

  it("uses the mandate's debit day when the pledge has none", () => {
    const setup = (debitDay: number) => ({
      paymentSetup: { mode: "ecs" as const, mandate: { status: "active" as const, bank: "", reference: "", debitDay }, note: "", updatedBy: new ObjectId(), updatedAt: new Date() },
    });
    expect(dueDayOf(pledge(setup(31)), "2026-02")).toBe(28);
    expect(ledger(pledge(setup(5)), [], new Map(), all, today).at(-1)?.state).toBe("overdue");
    expect(ledger(pledge({ ...setup(5), dueDay: 20 }), [], new Map(), all, today).at(-1)?.state).toBe("due");
  });

  it("skips paused months and stops at cancellation", () => {
    const rows = ledger(pledge({ pauses: [{ from: "2026-02", to: "2026-02" }], stoppedFrom: "2026-04", status: "cancelled" }), [], new Map(), all, today);
    expect(states(rows)).toEqual(["2026-01:missed", "2026-02:paused", "2026-03:missed"]);
    expect(rows[1]?.expected).toBe(0);
  });

  it("lets a reason excuse a month", () => {
    const notes = new Map([["2026-02", { reason: "travelling" as const, note: "", excused: true, by: new ObjectId(), at: new Date() }]]);
    const rows = ledger(pledge(), [], notes, all, today);
    expect(rows[1]?.state).toBe("excused");
    // March missed; this month is still to come; the excused February ends the run.
    expect(missedInRow(rows)).toBe(1);
  });

  it("steps by the frequency and counts payments in the period", () => {
    const rows = ledger(pledge({ frequency: "Quarterly", amount: 3000 }), [{ month: "2026-02", amount: 3000 }], new Map(), all, today);
    expect(states(rows)).toEqual(["2026-01:paid", "2026-04:due"]);
  });

  it("is due once for one-time gifts", () => {
    expect(states(ledger(pledge({ frequency: "One-time" }), [], new Map(), all, today))).toEqual(["2026-01:missed"]);
  });

  it("falls back to the first payment or creation month without a schedule", () => {
    const rows = ledger(pledge({ dueFrom: undefined, createdAt: new Date("2026-03-02") }), [{ month: "2026-02", amount: 1000 }], new Map(), all, today);
    expect(rows[0]?.month).toBe("2026-02");
  });

  it("guesses the schedule of older pledges from their last status change", () => {
    const legacy = (status: LedgerPledge["status"], at: string) =>
      pledge({ dueFrom: undefined, status, createdAt: new Date("2025-11-20"), lastStatusChange: { from: "contacted", to: status, at: new Date(at), by: new ObjectId() } });
    // Confirmed in February after being added in November: nothing due before February.
    expect(states(ledger(legacy("confirmed", "2026-02-03"), [], new Map(), all, today))[0]).toBe("2026-02:missed");
    // Paused in March: March onwards isn't missed.
    const paused = ledger({ ...legacy("paused", "2026-03-15"), dueFrom: undefined }, [{ month: "2025-12", amount: 1000 }], new Map(), all, today);
    expect(states(paused).slice(-3)).toEqual(["2026-02:missed", "2026-03:paused", "2026-04:paused"]);
    // Cancelled in March: nothing due from March.
    expect(states(ledger(legacy("cancelled", "2026-03-15"), [], new Map(), all, today)).at(-1)).toBe("2026-02:missed");
  });

  it("doesn't move the start when the earliest payment is deleted, once a schedule is recorded", () => {
    const p = pledge({ dueFrom: "2026-01" });
    expect(states(ledger(p, [], new Map(), all, today))[0]).toBe("2026-01:missed");
  });

  it("uses the amount pledged at the time", () => {
    const p = pledge({ amount: 2000, amountHistory: [{ amount: 1000, frequency: "Monthly", until: new Date("2026-03-10T06:00:00Z"), by: new ObjectId() }] });
    expect(amountFor(p, "2026-02")).toBe(1000);
    expect(amountFor(p, "2026-03")).toBe(2000);
  });

  it("has nothing due for pledges that aren't confirmed", () => {
    expect(ledger(pledge({ status: "contacted" }), [], new Map(), all, today)).toEqual([]);
  });
});

describe("scheduleFromHistory", () => {
  const legacy = pledge({ dueFrom: undefined, status: "confirmed" });
  const at = (d: string) => new Date(`${d}T06:00:00Z`);

  it("replays confirmations, pauses and cancellations", () => {
    const s = scheduleFromHistory(
      legacy,
      [
        { to: "new", at: at("2025-10-02") },
        { to: "confirmed", at: at("2025-11-10") },
        { to: "paused", at: at("2026-01-05") },
        { to: "confirmed", at: at("2026-03-01") },
      ],
      "2025-12",
    );
    expect(s).toEqual({ dueFrom: "2025-11", pauses: [{ from: "2026-01", to: "2026-02" }], fromHistory: true });
  });

  it("starts at an earlier payment", () => {
    expect(scheduleFromHistory(legacy, [{ to: "confirmed", at: at("2025-11-10") }], "2025-09").dueFrom).toBe("2025-09");
  });

  it("falls back to a guess when the history doesn't reach the current status", () => {
    const s = scheduleFromHistory({ ...legacy, status: "paused", updatedAt: at("2026-02-01") }, [{ to: "confirmed", at: at("2025-11-10") }]);
    expect(s.fromHistory).toBe(false);
    expect(s.pauses).toEqual([{ from: "2026-02" }]);
  });
});

describe("totals", () => {
  it("counts runs, what's owed and month totals", () => {
    const rows = ledger(pledge(), [{ month: "2026-01", amount: 1000 }, { month: "2026-03", amount: 400 }], new Map(), all, today);
    expect(missedInRow(rows)).toBe(2);
    expect(owedIn(rows)).toBe(1000 + 600);
    const t = totalsFor("2026-03", [rows[2]!]);
    expect(t).toMatchObject({ committed: 1000, collected: 400, outstanding: 600, excused: 0 });
    expect(t.sevaks.partial).toBe(1);
  });

  it("still lists a missed month after a later one was paid", () => {
    const rows = ledger(pledge(), [{ month: "2026-01", amount: 1000 }, { month: "2026-03", amount: 1000 }], new Map(), all, today);
    expect(missedInRow(rows)).toBe(0);
    expect(unpaidMonths(rows)).toEqual(["2026-02"]);
  });

  it("doesn't count this month as owing before its due day", () => {
    const rows = ledger(pledge({ dueDay: 20 }), [{ month: "2026-01", amount: 1000 }, { month: "2026-02", amount: 1000 }, { month: "2026-03", amount: 1000 }], new Map(), all, today);
    expect(missedInRow(rows)).toBe(0);
  });
});
