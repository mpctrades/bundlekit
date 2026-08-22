/**
 * BundleKit pricing core.
 *
 * Every price the merchant sees, the shopper sees, and the checkout charges
 * comes from this file. It is pure: no Shopify, no React, no I/O. That is
 * deliberate — it is the one piece of the app that must never be wrong, so it
 * is the one piece that is fully testable in isolation (see pricing.test.ts).
 *
 * All money is handled in MINOR UNITS (integer cents). Floats never touch a
 * price. The only rounding rule in the whole app lives in `applyPercentage`.
 *
 * A mirror of this logic exists in extensions/bundlekit-discount/src/pricing.js
 * because a Shopify Function is bundled separately. If you change one, change
 * both — the test suite asserts they agree.
 */

export type DiscountType = "percentage" | "amount" | "fixed_price";

export interface Tier {
  /** Minimum quantity that unlocks this tier. */
  quantity: number;
  type: DiscountType;
  /** percentage: 0-100 · amount: cents off the whole tier · fixed_price: cents total */
  value: number;
  /** Wears the "Most popular" badge. At most one tier should set this. */
  badge?: boolean;
}

export interface PricedTier {
  quantity: number;
  /** quantity x unit price, before discount */
  subtotal: number;
  /** what the shopper pays for the tier */
  total: number;
  /** subtotal - total, never negative */
  savings: number;
  /** total / quantity, rounded for display only */
  perUnit: number;
  /** effective discount, for the Function and for labels. 0-100, 2dp. */
  percentOff: number;
  badge: boolean;
}

/** Half-up rounding, the convention shoppers expect. Math.round() is half-up
 *  for positives, but is wrong for negatives, so we guard the sign. */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function applyPercentage(subtotalCents: number, percent: number): number {
  const clamped = clampPercent(percent);
  return roundHalfUp((subtotalCents * (100 - clamped)) / 100);
}

export function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

/**
 * The one place a tier turns into money.
 * Guarantees: total >= 0, total <= subtotal, savings = subtotal - total.
 */
export function priceTier(unitPriceCents: number, tier: Tier): PricedTier {
  const quantity = Math.max(1, Math.floor(tier.quantity));
  const subtotal = unitPriceCents * quantity;

  let total: number;
  switch (tier.type) {
    case "percentage":
      total = applyPercentage(subtotal, tier.value);
      break;
    case "amount":
      total = subtotal - roundHalfUp(tier.value);
      break;
    case "fixed_price":
      total = roundHalfUp(tier.value);
      break;
    default:
      total = subtotal;
  }

  // A discount may never exceed the goods or invert the price.
  total = Math.min(subtotal, Math.max(0, total));

  const savings = subtotal - total;
  return {
    quantity,
    subtotal,
    total,
    savings,
    perUnit: roundHalfUp(total / quantity),
    percentOff: subtotal === 0 ? 0 : round2((savings / subtotal) * 100),
    badge: Boolean(tier.badge),
  };
}

/** Starting tiers for a brand-new offer. Shared by the offer builder and the
 *  Design defaults page so their previews use identical numbers. Lives here
 *  (not offers.server.ts) because both server loaders and client components
 *  reference it, and .server.ts modules are stripped from client bundles. */
export const DEFAULT_TIERS: Tier[] = [
  { quantity: 2, type: "percentage", value: 10, badge: true },
  { quantity: 3, type: "percentage", value: 15 },
];

/** Tiers sorted ascending, deduplicated by quantity, quantity 1 excluded. */
export function normaliseTiers(tiers: Tier[]): Tier[] {
  const seen = new Map<number, Tier>();
  for (const tier of tiers) {
    const quantity = Math.floor(tier.quantity);
    if (quantity < 2) continue; // a "tier" at qty 1 is just the price
    seen.set(quantity, { ...tier, quantity });
  }
  return [...seen.values()].sort((a, b) => a.quantity - b.quantity);
}

/** The tier that applies to a cart line holding `quantity` units: the highest
 *  tier the shopper has actually reached. Returns null below the first tier. */
export function tierForQuantity(quantity: number, tiers: Tier[]): Tier | null {
  let match: Tier | null = null;
  for (const tier of normaliseTiers(tiers)) {
    if (quantity >= tier.quantity) match = tier;
  }
  return match;
}

/**
 * What the Function needs: given a line's real quantity and unit price, how
 * many cents to take off that line. Note this prices the ACTUAL quantity, not
 * the tier quantity — a shopper who reaches tier 3 and then types 5 into the
 * quantity box still gets the tier-3 rate on all five.
 */
export function lineDiscountCents(
  unitPriceCents: number,
  quantity: number,
  tiers: Tier[],
): number {
  const tier = tierForQuantity(quantity, tiers);
  if (!tier) return 0;

  if (tier.type === "percentage") {
    const subtotal = unitPriceCents * quantity;
    return subtotal - applyPercentage(subtotal, tier.value);
  }

  // Fixed amounts and fixed prices are defined for the tier's own quantity.
  // Beyond it, we repeat the tier as many whole times as it fits and leave the
  // remainder at full price. This is the behaviour merchants expect from
  // "3 for 50" and it never gives away more than was promised.
  const priced = priceTier(unitPriceCents, tier);
  const bundles = Math.floor(quantity / tier.quantity);
  return priced.savings * bundles;
}

/** Companion bundle (F4): a set of selected lines discounted together. */
export function priceCompanionBundle(
  linePriceCents: number[],
  discount: { type: DiscountType; value: number },
): { subtotal: number; total: number; savings: number; percentOff: number } {
  const subtotal = linePriceCents.reduce((sum, cents) => sum + cents, 0);
  const priced = priceTier(subtotal, { quantity: 1, ...discount });
  return {
    subtotal,
    total: priced.total,
    savings: priced.savings,
    percentOff: priced.percentOff,
  };
}

/**
 * Splitting a bundle discount back across its lines, largest-remainder style,
 * so the cents always add up to exactly the promised total. Without this you
 * get the classic "checkout is 1 cent off" bug review.
 */
export function allocateSavings(linePriceCents: number[], totalSavings: number): number[] {
  const subtotal = linePriceCents.reduce((sum, cents) => sum + cents, 0);
  if (subtotal <= 0 || totalSavings <= 0) return linePriceCents.map(() => 0);

  const exact = linePriceCents.map((cents) => (cents * totalSavings) / subtotal);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = totalSavings - floors.reduce((sum, value) => sum + value, 0);

  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  for (const { index } of order) {
    if (remainder <= 0) break;
    floors[index] += 1;
    remainder -= 1;
  }
  return floors;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
