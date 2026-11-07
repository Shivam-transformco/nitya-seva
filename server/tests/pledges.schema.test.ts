import { describe, expect, it } from "vitest";
import { paymentSetupBody } from "../src/modules/pledges/pledges.schema.js";

describe("paymentSetupBody", () => {
  it("needs the mandate status for auto-debits", () => {
    expect(paymentSetupBody.safeParse({ mode: "ecs" }).success).toBe(false);
    expect(paymentSetupBody.safeParse({ mode: "upi_autopay" }).success).toBe(false);
    const ok = paymentSetupBody.parse({ mode: "ecs", mandate: { status: "submitted", bank: " SBI ", debitDay: 5 } });
    expect(ok.mandate).toEqual({ status: "submitted", bank: "SBI", reference: "", debitDay: 5 });
  });

  it("drops mandate details for sevaks who pay by hand", () => {
    const parsed = paymentSetupBody.parse({ mode: "manual", mandate: { status: "active" }, note: "pays cash at the temple" });
    expect(parsed.mandate).toBeUndefined();
    expect(parsed.note).toBe("pays cash at the temple");
  });

  it("rejects impossible debit days and months", () => {
    expect(paymentSetupBody.safeParse({ mode: "ecs", mandate: { status: "active", debitDay: 32 } }).success).toBe(false);
    expect(paymentSetupBody.safeParse({ mode: "ecs", mandate: { status: "active", startMonth: "2026-13" } }).success).toBe(false);
  });
});
