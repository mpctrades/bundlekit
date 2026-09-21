import { describe, expect, it } from "vitest";
import { bucketByDay, computeTrend, deriveRateMetrics, summarizeByOffer, totalStats } from "./stats.server";

function stat(day: string, offer: { id: string; name: string; status: string }, values: Partial<{ views: number; selects: number; orders: number; revenue: number }> = {}) {
  return {
    id: `${offer.id}-${day}`,
    offerId: offer.id,
    day: new Date(`${day}T00:00:00.000Z`),
    views: 0,
    selects: 0,
    orders: 0,
    revenue: 0,
    ...values,
    offer,
  } as unknown as Parameters<typeof bucketByDay>[0][number];
}

const OFFER_A = { id: "off_a", name: "Buy more, save more", status: "live" };
const OFFER_B = { id: "off_b", name: "Companion bundle", status: "draft" };

describe("bucketByDay", () => {
  it("zero-fills every day in the range, even with no rows", () => {
    const buckets = bucketByDay([], 3);
    expect(buckets).toHaveLength(3);
    expect(buckets.every((bucket) => bucket.views === 0 && bucket.revenue === 0)).toBe(true);
  });

  it("sums same-day rows across offers into one bucket", () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = [
      stat(today, OFFER_A, { views: 10, orders: 1, revenue: 500 }),
      stat(today, OFFER_B, { views: 4, orders: 0, revenue: 0 }),
    ];
    const buckets = bucketByDay(rows, 1);
    expect(buckets).toEqual([{ day: today, views: 14, selects: 0, orders: 1, revenue: 500 }]);
  });

  it("drops rows outside the requested range instead of throwing", () => {
    const rows = [stat("2020-01-01", OFFER_A, { views: 99 })];
    const buckets = bucketByDay(rows, 1);
    expect(buckets[0].views).toBe(0);
  });
});

describe("summarizeByOffer", () => {
  it("rolls up per offer and sorts by revenue descending", () => {
    const rows = [
      stat("2026-08-01", OFFER_A, { revenue: 100 }),
      stat("2026-08-02", OFFER_A, { revenue: 50 }),
      stat("2026-08-01", OFFER_B, { revenue: 900 }),
    ];
    const summary = summarizeByOffer(rows);
    expect(summary.map((entry) => entry.offerId)).toEqual(["off_b", "off_a"]);
    expect(summary.find((entry) => entry.offerId === "off_a")?.revenue).toBe(150);
  });
});

describe("totalStats", () => {
  it("sums every field across all rows", () => {
    const rows = [
      stat("2026-08-01", OFFER_A, { views: 10, selects: 2, orders: 1, revenue: 500 }),
      stat("2026-08-02", OFFER_B, { views: 5, selects: 1, orders: 0, revenue: 0 }),
    ];
    expect(totalStats(rows)).toEqual({ views: 15, selects: 3, orders: 1, revenue: 500 });
  });

  it("returns all zeros for an empty range", () => {
    expect(totalStats([])).toEqual({ views: 0, selects: 0, orders: 0, revenue: 0 });
  });
});

describe("deriveRateMetrics", () => {
  it("computes conversion rate and AOV from totals", () => {
    expect(deriveRateMetrics({ views: 200, orders: 8, revenue: 800 })).toEqual({ conversionRate: 4, aov: 100 });
  });

  it("returns null instead of dividing by zero when there's no data yet", () => {
    expect(deriveRateMetrics({ views: 0, orders: 0, revenue: 0 })).toEqual({ conversionRate: null, aov: null });
  });

  it("keeps a real 0% conversion distinct from no data", () => {
    expect(deriveRateMetrics({ views: 50, orders: 0, revenue: 0 }).conversionRate).toBe(0);
  });
});

describe("computeTrend", () => {
  it("reports an upward percentage when current exceeds previous", () => {
    expect(computeTrend(150, 100)).toEqual({ direction: "up", percent: 50 });
  });

  it("reports a downward percentage when current is below previous", () => {
    expect(computeTrend(50, 100)).toEqual({ direction: "down", percent: 50 });
  });

  it("treats a sub-0.5% move as flat rather than up or down", () => {
    expect(computeTrend(100.2, 100)).toEqual({ direction: "flat", percent: 0 });
  });

  it("returns null when both periods are zero — nothing to compare", () => {
    expect(computeTrend(0, 0)).toBeNull();
  });

  it("treats going from zero to something as a new-activity case, not +Infinity%", () => {
    expect(computeTrend(40, 0)).toEqual({ direction: "up", percent: 100 });
  });
});
