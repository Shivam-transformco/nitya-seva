import { describe, expect, it } from "vitest";
import { DEFAULT_SEVA, splitSeva, submitBody } from "../src/modules/public/public.schema.js";

const valid = {
  name: "Radha",
  phone: "99719 32510",
  email: "",
  amount: "2100",
  frequency: "Monthly",
  message: "Seva: Prachar Sahyog Seva\nHare Krishna",
  website: "",
  consent: "yes",
  submittedFrom: "https://nityaseva.iskconjiasarai.com/",
};

describe("submitBody", () => {
  it("accepts what the current site sends", () => {
    const parsed = submitBody.parse(valid);
    expect(parsed.amount).toBe(2100);
    expect(parsed.phone).toBe("+919971932510");
  });

  it.each([
    ["non-numeric amount", { amount: "abc" }],
    ["fractional amount", { amount: "1100.50" }],
    ["zero amount", { amount: "0" }],
    ["huge amount", { amount: "99999999" }],
    ["bad phone", { phone: "12345" }],
    ["missing consent", { consent: "" }],
    ["bad email", { email: "not-an-email" }],
  ])("rejects %s", (_label, override) => {
    expect(submitBody.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe("splitSeva", () => {
  it("pulls the seva line out of the message", () => {
    expect(splitSeva({ message: "Seva: Prachar Sahyog Seva\nHare Krishna" })).toEqual({
      seva: "Prachar Sahyog Seva",
      message: "Hare Krishna",
    });
  });

  it("falls back to the default seva", () => {
    expect(splitSeva({ message: "Hare Krishna" })).toEqual({ seva: DEFAULT_SEVA, message: "Hare Krishna" });
  });

  it("prefers an explicit seva field", () => {
    expect(splitSeva({ seva: "Vaishnav Prasad Seva", message: "hi" })).toEqual({ seva: "Vaishnav Prasad Seva", message: "hi" });
  });
});
