import prisma from "../db.server";

export interface DayBucket {
  day: string; // "YYYY-MM-DD"
  views: number;
  selects: number;
  orders: number;
  revenue: number;
}

export interface OfferSummary {
  offerId: string;
  name: string;
  status: string;
  views: number;
  selects: number;
  orders: number;
  revenue: number;
}

export interface StatTotals {
  views: number;
  selects: number;
  orders: number;
  revenue: number;
}

/** Orders as a share of widget views, and revenue per order — derived
 *  rather than stored, so they stay consistent with whatever range/offer
 *  slice the totals were computed over. Null when there's no denominator
 *  yet, so callers can render an empty state instead of a bogus 0%/$0. */
export function deriveRateMetrics(totals: { views: number; orders: number; revenue: number }): {
  conversionRate: number | null;
  aov: number | null;
} {
  return {
    conversionRate: totals.views > 0 ? (totals.orders / totals.views) * 100 : null,
    aov: totals.orders > 0 ? totals.revenue / totals.orders : null,
  };
}

/** DB query — every OfferStat row for a shop across the last `days` days. */
export async function fetchStatsForRange(shopId: string, days: number) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  return prisma.offerStat.findMany({
    where: { offer: { shopId }, day: { gte: since } },
    include: { offer: { select: { id: true, name: true, status: true } } },
    orderBy: { day: "asc" },
  });
}

/** DB query — the block of `days` immediately before the current range, so
 *  KPI cards can show a "vs previous period" trend instead of a bare number. */
export async function fetchStatsForPreviousRange(shopId: string, days: number) {
  const currentSince = new Date();
  currentSince.setUTCHours(0, 0, 0, 0);
  currentSince.setUTCDate(currentSince.getUTCDate() - (days - 1));

  const previousUntil = new Date(currentSince);
  previousUntil.setUTCDate(previousUntil.getUTCDate() - 1);
  const previousSince = new Date(currentSince);
  previousSince.setUTCDate(previousSince.getUTCDate() - days);

  return prisma.offerStat.findMany({
    where: { offer: { shopId }, day: { gte: previousSince, lte: previousUntil } },
    include: { offer: { select: { id: true, name: true, status: true } } },
  });
}

type RawStat = Awaited<ReturnType<typeof fetchStatsForRange>>[number];

/** One bucket per calendar day, zero-filled so the chart never has gaps. */
export function bucketByDay(rows: RawStat[], days: number): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, { day: key, views: 0, selects: 0, orders: 0, revenue: 0 });
  }
  for (const row of rows) {
    const key = row.day.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue; // outside the requested range
    bucket.views += row.views;
    bucket.selects += row.selects;
    bucket.orders += row.orders;
    bucket.revenue += Number(row.revenue);
  }
  return [...buckets.values()];
}

/** Per-offer rollup, highest revenue first. */
export function summarizeByOffer(rows: RawStat[]): OfferSummary[] {
  const byOffer = new Map<string, OfferSummary>();
  for (const row of rows) {
    const existing = byOffer.get(row.offer.id) ?? {
      offerId: row.offer.id,
      name: row.offer.name,
      status: row.offer.status,
      views: 0,
      selects: 0,
      orders: 0,
      revenue: 0,
    };
    existing.views += row.views;
    existing.selects += row.selects;
    existing.orders += row.orders;
    existing.revenue += Number(row.revenue);
    byOffer.set(row.offer.id, existing);
  }
  return [...byOffer.values()].sort((a, b) => b.revenue - a.revenue);
}

export interface Trend {
  direction: "up" | "down" | "flat";
  percent: number;
}

/** Percent change vs. the previous period, for a KPI card's trend chip.
 *  Null when there's nothing to compare against (previous period had zero) —
 *  a "0 -> N" jump isn't a meaningful percentage, so the card shows "New"
 *  instead of a misleading +∞%. */
export function computeTrend(current: number, previous: number): Trend | null {
  if (previous === 0) return current === 0 ? null : { direction: "up", percent: 100 };
  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 0.5) return { direction: "flat", percent: 0 };
  return { direction: percent > 0 ? "up" : "down", percent: Math.abs(percent) };
}

/** Totals across the whole set, for KPI cards. */
export function totalStats(rows: RawStat[]): StatTotals {
  return rows.reduce(
    (acc, row) => ({
      views: acc.views + row.views,
      selects: acc.selects + row.selects,
      orders: acc.orders + row.orders,
      revenue: acc.revenue + Number(row.revenue),
    }),
    { views: 0, selects: 0, orders: 0, revenue: 0 },
  );
}
