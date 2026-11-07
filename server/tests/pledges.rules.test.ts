import { describe, expect, it } from "vitest";
import { canTransition, statusAfterFollowup } from "../src/modules/pledges/pledges.rules.js";

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
