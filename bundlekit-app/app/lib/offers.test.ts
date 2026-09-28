import { describe, expect, it } from "vitest";
import { computeDisplayStatus, findMissingDiscounts } from "./offers.server";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

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

describe("findMissingDiscounts", () => {
  const adminReturning = (nodes: Array<{ id: string } | null>) => {
    const calls: unknown[] = [];
    const admin = {
      graphql: async (_query: string, options: unknown) => {
        calls.push(options);
        return new Response(JSON.stringify({ data: { nodes } }));
      },
    } as unknown as AdminApiContext;
    return { admin, calls };
  };

  it("reports ids Shopify returns as null (deleted discounts)", async () => {
    const { admin } = adminReturning([{ id: "gid://shopify/DiscountAutomaticNode/1" }, null]);
    const missing = await findMissingDiscounts(admin, [
      "gid://shopify/DiscountAutomaticNode/1",
      "gid://shopify/DiscountAutomaticNode/2",
    ]);
    expect([...missing]).toEqual(["gid://shopify/DiscountAutomaticNode/2"]);
  });

  it("reports nothing missing when every discount exists", async () => {
    const { admin } = adminReturning([{ id: "gid://shopify/DiscountAutomaticNode/1" }]);
    expect((await findMissingDiscounts(admin, ["gid://shopify/DiscountAutomaticNode/1"])).size).toBe(0);
  });

  it("skips the Admin API call entirely for an empty list", async () => {
    const { admin, calls } = adminReturning([]);
    expect((await findMissingDiscounts(admin, [])).size).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
