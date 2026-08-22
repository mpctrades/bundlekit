// @ts-check
/**
 * BundleKit discount Function.
 *
 * This is the promise-keeping half of the app. The widget says "2 units, save
 * 10%"; this decides what Shopify actually charges. If the two ever disagree,
 * the app is worthless — which is why the arithmetic lives in pricing.js and
 * is tested, and why this file does nothing but plumbing.
 *
 * It reads two metafields:
 *   - the discount node's own config (which offer this discount serves)
 *   - the product's offer JSON (the tiers, same bytes the widget rendered)
 *
 * Matching on the product metafield means targeting is decided once, in the
 * admin, and both sides read the same source of truth.
 */

import { lineDiscountCents, normaliseTiers } from "./pricing.js";

/** @typedef {import("../generated/api").RunInput} RunInput */
/** @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult */

const EMPTY = /** @type {FunctionRunResult} */ ({
  discountApplicationStrategy: "FIRST",
  discounts: [],
});

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const config = parse(input?.discountNode?.config?.value);
  if (!config) return EMPTY;

  const tiers = normaliseTiers(config.tiers || []);
  const lines = input?.cart?.lines || [];
  const discounts = [];

  if (config.kind === "companion") {
    const bundleDiscount = companionDiscount(lines, config);
    if (bundleDiscount) discounts.push(bundleDiscount);
    return discounts.length ? { discountApplicationStrategy: "FIRST", discounts } : EMPTY;
  }

  for (const line of lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;

    const offer = parse(line.merchandise.product?.offer?.value);
    // The discount only touches products this offer targets.
    if (!offer || offer.id !== config.offerId) continue;

    const unitPrice = toCents(line.cost?.amountPerQuantity?.amount);
    if (!unitPrice) continue;

    const lineTiers = normaliseTiers(offer.tiers || tiers);
    const saving = lineDiscountCents(unitPrice, line.quantity, lineTiers);
    if (saving <= 0) continue;

    discounts.push({
      targets: [{ cartLine: { id: line.id } }],
      value: {
        fixedAmount: {
          amount: fromCents(saving),
          // The saving is already computed for the whole line.
          appliesToEachItem: false,
        },
      },
      message: label(config, lineTiers, line.quantity),
    });
  }

  return discounts.length ? { discountApplicationStrategy: "FIRST", discounts } : EMPTY;
}

/**
 * Companion bundles: every line the widget added carries the same `_bundlekit`
 * property. We discount those lines together, splitting the saving across them
 * so the cents add up exactly.
 */
function companionDiscount(lines, config) {
  const tagged = lines.filter(
    (line) =>
      line.bundleTag?.value === config.offerId &&
      line.merchandise.__typename === "ProductVariant",
  );
  // A "bundle" of one is just a product. Don't discount it.
  if (tagged.length < 2) return null;

  const discount = config.companionDiscount;
  if (!discount || discount.type !== "percentage") return null;

  return {
    targets: tagged.map((line) => ({ cartLine: { id: line.id } })),
    value: { percentage: { value: String(clamp(discount.value)) } },
    message: config.label || "Bundle",
  };
}

function label(config, tiers, quantity) {
  const base = config.label || "Bundle";
  let reached = null;
  for (const tier of tiers) if (quantity >= tier.quantity) reached = tier;
  if (!reached) return base;
  return reached.type === "percentage"
    ? `${base} — ${clamp(reached.value)}% off`
    : base;
}

function parse(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    // A malformed metafield must never take down the checkout.
    return null;
  }
}

/** Shopify hands us decimal strings. Convert once, at the boundary. */
function toCents(amount) {
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function fromCents(cents) {
  return (cents / 100).toFixed(2);
}

function clamp(percent) {
  const value = Number(percent);
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
