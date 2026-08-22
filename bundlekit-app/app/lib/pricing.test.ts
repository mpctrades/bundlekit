import { describe, expect, it } from "vitest";
import {
  allocateSavings,
  lineDiscountCents,
  normaliseTiers,
  priceCompanionBundle,
  priceTier,
  tierForQuantity,
  type Tier,
} from "./pricing";

const TONER = 1990; // €19.90 — the brief's example product

describe("priceTier", () => {
  it("matches the numbers printed in the brief", () => {
    const two = priceTier(TONER, { quantity: 2, type: "percentage", value: 10 });
    expect(two.subtotal).toBe(3980);
    expect(two.total).toBe(3582); // €35.82
    expect(two.savings).toBe(398); // €3.98
    expect(two.perUnit).toBe(1791); // €17.91

    const three = priceTier(TONER, { quantity: 3, type: "percentage", value: 15 });
    expect(three.subtotal).toBe(5970);
    expect(three.total).toBe(5075); // €50.75, half-up from 5074.5
    expect(three.savings).toBe(895); // €8.95
    expect(three.perUnit).toBe(1692); // €16.92
  });

  it("rounds half up, not half to even", () => {
    // 5970 * 0.85 = 5074.5 -> 5075, not 5074
    expect(priceTier(5970, { quantity: 1, type: "percentage", value: 15 }).total).toBe(5075);
  });

  it("handles fixed amount off", () => {
    const tier = priceTier(TONER, { quantity: 2, type: "amount", value: 500 });
    expect(tier.total).toBe(3480);
    expect(tier.savings).toBe(500);
  });

  it("handles fixed bundle price", () => {
    const tier = priceTier(TONER, { quantity: 3, type: "fixed_price", value: 4500 });
    expect(tier.total).toBe(4500);
    expect(tier.savings).toBe(1470);
    expect(tier.perUnit).toBe(1500);
  });

  it("never lets a discount exceed the goods", () => {
    expect(priceTier(1000, { quantity: 1, type: "amount", value: 9999 }).total).toBe(0);
    expect(priceTier(1000, { quantity: 1, type: "percentage", value: 300 }).total).toBe(0);
    expect(priceTier(1000, { quantity: 1, type: "percentage", value: -50 }).total).toBe(1000);
  });

  it("never inflates the price via fixed_price above subtotal", () => {
    expect(priceTier(1000, { quantity: 2, type: "fixed_price", value: 9999 }).total).toBe(2000);
    expect(priceTier(1000, { quantity: 2, type: "fixed_price", value: 9999 }).savings).toBe(0);
  });

  it("keeps savings = subtotal - total for any input", () => {
    for (const price of [1, 99, 1990, 12345]) {
      for (const value of [0, 3, 7.5, 33, 99]) {
        const tier = priceTier(price, { quantity: 3, type: "percentage", value });
        expect(tier.savings).toBe(tier.subtotal - tier.total);
        expect(Number.isInteger(tier.total)).toBe(true);
      }
    }
  });
});

describe("tier selection", () => {
  const tiers: Tier[] = [
    { quantity: 3, type: "percentage", value: 15 },
    { quantity: 2, type: "percentage", value: 10, badge: true },
  ];

  it("sorts, and drops meaningless qty-1 tiers", () => {
    const normalised = normaliseTiers([...tiers, { quantity: 1, type: "percentage", value: 5 }]);
    expect(normalised.map((tier) => tier.quantity)).toEqual([2, 3]);
  });

  it("picks the highest tier reached", () => {
    expect(tierForQuantity(1, tiers)).toBeNull();
    expect(tierForQuantity(2, tiers)?.quantity).toBe(2);
    expect(tierForQuantity(4, tiers)?.quantity).toBe(3);
  });
});

describe("lineDiscountCents", () => {
  const tiers: Tier[] = [
    { quantity: 2, type: "percentage", value: 10 },
    { quantity: 3, type: "percentage", value: 15 },
  ];

  it("gives nothing below the first tier", () => {
    expect(lineDiscountCents(TONER, 1, tiers)).toBe(0);
  });

  it("prices the real quantity, not the tier quantity", () => {
    expect(lineDiscountCents(TONER, 2, tiers)).toBe(398);
    expect(lineDiscountCents(TONER, 3, tiers)).toBe(895);
    // 5 units at the tier-3 rate of 15%. We round the PRICE half-up
    // (9950 * 0.85 = 8457.5 -> 8458), so the saving is the remainder: 1492.
    // Rounding the saving instead would give 1493 and a checkout that is one
    // cent off the widget. Pick one rule and let the test hold it still.
    expect(lineDiscountCents(TONER, 5, tiers)).toBe(1492);
  });

  it("repeats fixed-price tiers whole times only", () => {
    const fixed: Tier[] = [{ quantity: 3, type: "fixed_price", value: 4500 }];
    expect(lineDiscountCents(TONER, 3, fixed)).toBe(1470);
    expect(lineDiscountCents(TONER, 5, fixed)).toBe(1470); // one bundle + 2 loose
    expect(lineDiscountCents(TONER, 6, fixed)).toBe(2940); // two bundles
  });
});

describe("priceCompanionBundle", () => {
  it("matches the routine example (19.90 + 24.50, -12%)", () => {
    const bundle = priceCompanionBundle([1990, 2450], { type: "percentage", value: 12 });
    expect(bundle.subtotal).toBe(4440);
    expect(bundle.total).toBe(3907); // €39.07
    expect(bundle.savings).toBe(533); // €5.33
  });

  it("matches the full routine (three items, -12%)", () => {
    const bundle = priceCompanionBundle([1990, 2450, 1890], { type: "percentage", value: 12 });
    expect(bundle.subtotal).toBe(6330);
    expect(bundle.total).toBe(5570); // €55.70
    expect(bundle.savings).toBe(760);
  });
});

describe("allocateSavings", () => {
  it("always adds up to the promised total", () => {
    const lines = [1990, 2450, 1890];
    for (const savings of [1, 7, 533, 760, 999]) {
      const split = allocateSavings(lines, savings);
      expect(split.reduce((sum, cents) => sum + cents, 0)).toBe(savings);
      expect(split.every((cents) => cents >= 0)).toBe(true);
    }
  });

  it("gives the odd cent to the largest remainder", () => {
    expect(allocateSavings([1000, 1000, 1000], 100)).toEqual([34, 33, 33]);
  });

  it("is a no-op when there is nothing to split", () => {
    expect(allocateSavings([1000, 2000], 0)).toEqual([0, 0]);
  });
});
