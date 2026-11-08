import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { can, canManageRole, permissionsFor } from "../src/domain/permissions.js";
import { monthlyEquivalent, originOf } from "../src/modules/pledges/pledges.rules.js";
import { monthsInRange, receivedAtForMonth } from "../src/modules/payments/payments.rules.js";

describe("permissions", () => {
  it("keeps the owner-only powers to owners", () => {
    expect(can("owner", "audit.view")).toBe(true);
    expect(can("admin", "audit.view")).toBe(false);
    expect(can("admin", "bin.purge")).toBe(false);
    expect(can("admin", "bin.manage")).toBe(true);
  });

  it("lets accounts handle money but not run follow-ups", () => {
    expect(can("accounts", "payments.manage")).toBe(true);
    expect(can("accounts", "pledges.viewAll")).toBe(true);
    expect(can("accounts", "pledges.manage")).toBe(false);
    expect(can("accounts", "staff.manage")).toBe(false);
  });

  it("gives viewers reports only, without phone numbers", () => {
    expect(permissionsFor("viewer")).toEqual(["reports.view"]);
    expect(permissionsFor("followup")).toEqual([]);
  });

  it("stops admins managing admins or owners", () => {
    expect(canManageRole("admin", "followup")).toBe(true);
    expect(canManageRole("admin", "accounts")).toBe(true);
    expect(canManageRole("admin", "admin")).toBe(false);
    expect(canManageRole("admin", "owner")).toBe(false);
    expect(canManageRole("owner", "admin")).toBe(true);
    expect(canManageRole("accounts", "viewer")).toBe(false);
  });
});

describe("monthlyEquivalent", () => {
  it("spreads a gift over the months it covers", () => {
    expect(monthlyEquivalent(1100, "Monthly")).toBe(1100);
    expect(monthlyEquivalent(3000, "Quarterly")).toBe(1000);
    expect(monthlyEquivalent(6000, "Half-yearly")).toBe(1000);
    expect(monthlyEquivalent(1000, "Yearly")).toBe(83);
  });

  it("counts a one-time gift as nothing per month", () => {
    expect(monthlyEquivalent(5000, "One-time")).toBe(0);
  });
});

describe("originOf", () => {
  it("reads older pledges without an origin", () => {
    expect(originOf({})).toBe("website");
    expect(originOf({ legacyId: new ObjectId() })).toBe("legacy");
    expect(originOf({ origin: "google_form" })).toBe("google_form");
  });
});

describe("monthsInRange", () => {
  it("includes both ends and crosses years", () => {
    expect(monthsInRange("2024-11", "2025-02")).toEqual(["2024-11", "2024-12", "2025-01", "2025-02"]);
  });

  it("steps by the gift frequency", () => {
    expect(monthsInRange("2024-01", "2024-12", 3)).toEqual(["2024-01", "2024-04", "2024-07", "2024-10"]);
  });

  it("is empty when the range runs backwards", () => {
    expect(monthsInRange("2025-03", "2025-01")).toEqual([]);
  });
});

describe("receivedAtForMonth", () => {
  it("uses noon IST on the 1st", () => {
    expect(receivedAtForMonth("2024-05", new Date("2026-01-01")).toISOString()).toBe("2024-05-01T06:30:00.000Z");
  });

  it("never lands in the future", () => {
    const now = new Date("2026-11-01T03:00:00Z");
    expect(receivedAtForMonth("2026-11", now)).toBe(now);
  });
});
