import { describe, expect, it } from "vitest";
import { computeDisplayStatus } from "./offers.server";

const NOW = new Date("2026-08-22T12:00:00Z");

describe("computeDisplayStatus", () => {
  it("is draft when never published", () => {
    expect(computeDisplayStatus({ status: "draft", startsAt: null, endsAt: null }, NOW)).toBe("draft");
  });

  it("is paused when manually paused", () => {
    expect(computeDisplayStatus({ status: "paused", startsAt: null, endsAt: null }, NOW)).toBe("paused");
  });

  it("is live when published with no schedule", () => {
    expect(computeDisplayStatus({ status: "live", startsAt: null, endsAt: null }, NOW)).toBe("live");
  });

  it("is scheduled when startsAt is in the future", () => {
    const startsAt = new Date("2026-08-30T00:00:00Z");
    expect(computeDisplayStatus({ status: "live", startsAt, endsAt: null }, NOW)).toBe("scheduled");
  });

  it("is live once startsAt has passed", () => {
    const startsAt = new Date("2026-08-01T00:00:00Z");
    expect(computeDisplayStatus({ status: "live", startsAt, endsAt: null }, NOW)).toBe("live");
  });

  it("is paused once endsAt has passed", () => {
    const endsAt = new Date("2026-08-01T00:00:00Z");
    expect(computeDisplayStatus({ status: "live", startsAt: null, endsAt }, NOW)).toBe("paused");
  });

  it("is live between startsAt and endsAt", () => {
    const startsAt = new Date("2026-08-01T00:00:00Z");
    const endsAt = new Date("2026-09-01T00:00:00Z");
    expect(computeDisplayStatus({ status: "live", startsAt, endsAt }, NOW)).toBe("live");
  });
});
