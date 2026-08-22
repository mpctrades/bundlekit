/**
 * Mirror of app/lib/pricing.ts, in plain JS, because a Shopify Function is
 * bundled on its own and cannot import the app's TypeScript.
 *
 * INVARIANT: these two files must agree. run.test.js asserts the numbers
 * against the same fixtures used by app/lib/pricing.test.ts. If you change one,
 * change both, and let the tests tell you that you did.
 */

export function roundHalfUp(value) {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function clampPercent(percent) {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

export function applyPercentage(subtotalCents, percent) {
  return roundHalfUp((subtotalCents * (100 - clampPercent(percent))) / 100);
}

export function priceTier(unitPriceCents, tier) {
  const quantity = Math.max(1, Math.floor(tier.quantity));
  const subtotal = unitPriceCents * quantity;

  let total;
  if (tier.type === "percentage") total = applyPercentage(subtotal, tier.value);
  else if (tier.type === "amount") total = subtotal - roundHalfUp(tier.value);
  else if (tier.type === "fixed_price") total = roundHalfUp(tier.value);
  else total = subtotal;

  total = Math.min(subtotal, Math.max(0, total));
  const savings = subtotal - total;

  return {
    quantity,
    subtotal,
    total,
    savings,
    perUnit: roundHalfUp(total / quantity),
    percentOff: subtotal === 0 ? 0 : Math.round((savings / subtotal) * 10000) / 100,
    badge: Boolean(tier.badge),
  };
}

export function normaliseTiers(tiers) {
  const seen = new Map();
  for (const tier of tiers || []) {
    const quantity = Math.floor(tier.quantity);
    if (quantity < 2) continue;
    seen.set(quantity, { ...tier, quantity });
  }
  return [...seen.values()].sort((a, b) => a.quantity - b.quantity);
}

export function tierForQuantity(quantity, tiers) {
  let match = null;
  for (const tier of normaliseTiers(tiers)) if (quantity >= tier.quantity) match = tier;
  return match;
}

export function lineDiscountCents(unitPriceCents, quantity, tiers) {
  const tier = tierForQuantity(quantity, tiers);
  if (!tier) return 0;

  if (tier.type === "percentage") {
    const subtotal = unitPriceCents * quantity;
    return subtotal - applyPercentage(subtotal, tier.value);
  }

  const priced = priceTier(unitPriceCents, tier);
  const bundles = Math.floor(quantity / tier.quantity);
  return priced.savings * bundles;
}
