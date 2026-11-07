import { describe, expect, it } from "vitest";
import { adjustmentTotals, displayedTotals } from "../src/modules/counter/counter.rules.js";

const adj = (amount: number, sevaks: number, active = true) => ({ amount, sevaks, active });

describe("counter adjustments", () => {
  it("adds active adjustments to the real totals", () => {
    expect(displayedTotals({ amount: 1000, sevaks: 2 }, [adj(5000, 3), adj(-500, 0)])).toEqual({ amount: 5500, sevaks: 5 });
  });

  it("ignores inactive adjustments", () => {
    expect(adjustmentTotals([adj(5000, 3, false), adj(100, 1)])).toEqual({ amount: 100, sevaks: 1 });
  });

  it("never shows a negative counter", () => {
    expect(displayedTotals({ amount: 1000, sevaks: 1 }, [adj(-5000, -4)])).toEqual({ amount: 0, sevaks: 0 });
  });

  it("shows the real totals when there are no adjustments", () => {
    expect(displayedTotals({ amount: 28105, sevaks: 14 }, [])).toEqual({ amount: 28105, sevaks: 14 });
  });
});
