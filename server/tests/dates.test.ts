import { describe, expect, it } from "vitest";
import { endOfIstDay, istMonth } from "../src/lib/dates.js";

describe("IST dates", () => {
  it("uses India time for the month boundary", () => {
    // 31 Oct 2026, 20:00 UTC is already 1 Nov in India.
    expect(istMonth(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11");
    expect(istMonth(new Date("2026-10-31T18:00:00Z"))).toBe("2026-10");
  });

  it("ends the day at 23:59:59.999 IST", () => {
    expect(endOfIstDay(new Date("2026-11-06T10:00:00Z")).toISOString()).toBe("2026-11-06T18:29:59.999Z");
  });
});
