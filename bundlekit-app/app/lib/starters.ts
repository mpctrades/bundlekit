import type { Tier } from "./pricing";

/**
 * Ready-made first offers for the empty Dashboard. Each one opens the normal
 * offer builder already filled in (name, tiers and the store's own products),
 * so a new merchant reviews it and clicks Publish instead of facing a blank
 * form. Shared by the Dashboard (cards) and the builder's loader (pre-fill),
 * so it lives outside .server.ts.
 */
export interface StarterOffer {
  id: string;
  title: string;
  description: string;
  name: string;
  tiers: Tier[];
  recommended?: boolean;
}

export const STARTER_OFFERS: StarterOffer[] = [
  {
    id: "buy-2-save-10",
    title: "Buy 2, save 10%",
    description: "The simplest bundle. Works for almost any product.",
    name: "Buy 2, save 10%",
    tiers: [{ quantity: 2, type: "percentage", value: 10, badge: true }],
    recommended: true,
  },
  {
    id: "tiered-5-10-15",
    title: "Buy more, save more",
    description: "Three steps that reward bigger carts: 2, 3 or 4 units.",
    name: "Buy more, save more",
    tiers: [
      { quantity: 2, type: "percentage", value: 5 },
      { quantity: 3, type: "percentage", value: 10, badge: true },
      { quantity: 4, type: "percentage", value: 15 },
    ],
  },
  {
    id: "buy-3-save-20",
    title: "Buy 3, save 20%",
    description: "A bigger reward for stocking up. Good for consumables.",
    name: "Buy 3, save 20%",
    tiers: [{ quantity: 3, type: "percentage", value: 20, badge: true }],
  },
];

export function findStarter(id: string | null | undefined): StarterOffer | null {
  if (!id) return null;
  return STARTER_OFFERS.find((starter) => starter.id === id) ?? null;
}

/** "Buy 2 → 10% off · Buy 3 → 15% off" */
export function describeTiers(tiers: Tier[]): string {
  return tiers
    .map((tier) => `Buy ${tier.quantity} → ${tier.type === "percentage" ? `${tier.value}% off` : `${tier.value} off`}`)
    .join(" · ");
}

const MAX_STARTER_PRODUCTS = 10;

/** `?products=` from a starter link: numeric ids or Product gids, comma
 *  separated. Anything else is dropped; never more than 10. Returns gids. */
export function parseStarterProductIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const ids = new Set<string>();
  for (const part of raw.split(",")) {
    const value = part.trim();
    const numeric = /^\d{1,20}$/.test(value) ? value : /^gid:\/\/shopify\/Product\/(\d{1,20})$/.exec(value)?.[1];
    if (numeric) ids.add(`gid://shopify/Product/${numeric}`);
    if (ids.size >= MAX_STARTER_PRODUCTS) break;
  }
  return [...ids];
}

/** Product gid -> the short numeric form used in starter links. */
export function productNumericId(gid: string): string {
  return gid.slice(gid.lastIndexOf("/") + 1);
}

/** Most-ordered products first, from recent order line items. */
export function rankBestSellers(lines: Array<{ productId: string | null; quantity: number }>, limit: number): string[] {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.productId) continue;
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + Math.max(0, line.quantity));
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
