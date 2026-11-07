import { describe, expect, it } from "vitest";
import { normalizePhone } from "../src/lib/phone.js";

describe("normalizePhone", () => {
  it.each([
    ["9971932510", "+919971932510"],
    ["99719 32510", "+919971932510"],
    ["+91 99719-32510", "+919971932510"],
    ["09971932510", "+919971932510"],
    ["919971932510", "+919971932510"],
    ["+1 415 555 0100", "+14155550100"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "1234567890", "abc", "+12345"])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
