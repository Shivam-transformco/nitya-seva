import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { canTransition, conflictsWithPayments, statusAfterFollowup, undoTarget } from "../src/modules/pledges/pledges.rules.js";

describe("canTransition", () => {
  it("follows the lifecycle", () => {
    expect(canTransition("new", "contacted")).toBe(true);
    expect(canTransition("contacted", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "paused")).toBe(true);
    expect(canTransition("paused", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "cancelled")).toBe(true);
  });

  it("blocks shortcuts that skip meaning", () => {
    expect(canTransition("new", "paused")).toBe(false);
    expect(canTransition("confirmed", "lost")).toBe(false);
    expect(canTransition("lost", "confirmed")).toBe(false);
  });
});

describe("statusAfterFollowup", () => {
  it("moves a new pledge to contacted on any contact", () => {
    expect(statusAfterFollowup("new", "no_answer")).toBe("contacted");
    expect(statusAfterFollowup("new", "reached")).toBe("contacted");
  });

  it("confirms on a confirmed outcome", () => {
    expect(statusAfterFollowup("contacted", "confirmed")).toBe("confirmed");
    expect(statusAfterFollowup("cancelled", "confirmed")).toBe("confirmed");
  });

  it("treats declined as lost before confirmation and cancelled after", () => {
    expect(statusAfterFollowup("contacted", "declined")).toBe("lost");
    expect(statusAfterFollowup("confirmed", "declined")).toBe("cancelled");
    expect(statusAfterFollowup("paused", "declined")).toBe("cancelled");
  });

  it("leaves the status alone otherwise", () => {
    expect(statusAfterFollowup("contacted", "no_answer")).toBeNull();
    expect(statusAfterFollowup("confirmed", "reached")).toBeNull();
    expect(statusAfterFollowup("confirmed", "confirmed")).toBeNull();
  });
});

describe("undoTarget", () => {
  const change = { from: "new", to: "contacted", by: new ObjectId(), at: new Date() } as const;

  it("puts back the status from before the last change", () => {
    expect(undoTarget({ status: "contacted", lastStatusChange: change })).toBe("new");
  });

  it("has nothing to undo once the status has moved on, or without a recorded change", () => {
    expect(undoTarget({ status: "confirmed", lastStatusChange: change })).toBeNull();
    expect(undoTarget({ status: "contacted" })).toBeNull();
  });
});

describe("conflictsWithPayments", () => {
  it("keeps a pledge with payments from going back to a never-confirmed status", () => {
    expect(conflictsWithPayments("contacted", 1)).toBe(true);
    expect(conflictsWithPayments("lost", 2)).toBe(true);
    expect(conflictsWithPayments("cancelled", 1)).toBe(false);
    expect(conflictsWithPayments("paused", 1)).toBe(false);
    expect(conflictsWithPayments("new", 0)).toBe(false);
  });
});
