import { describe, expect, it } from "vitest";
import { run } from "./run.js";
import { lineDiscountCents, priceTier } from "./pricing.js";

const OFFER = {
  id: "off_1",
  tiers: [
    { quantity: 2, type: "percentage", value: 10, badge: true },
    { quantity: 3, type: "percentage", value: 15 },
  ],
};

const CONFIG = { offerId: "off_1", kind: "quantity", tiers: OFFER.tiers, label: "BundleKit" };

function cart(lines) {
  return {
    cart: { lines },
    discountNode: { config: { value: JSON.stringify(CONFIG) } },
  };
}

function line(quantity, { price = "19.90", offer = OFFER, id = "gid://shopify/CartLine/1" } = {}) {
  return {
    id,
    quantity,
    cost: { amountPerQuantity: { amount: price } },
    bundleTag: null,
    merchandise: {
      __typename: "ProductVariant",
      id: "gid://shopify/ProductVariant/1",
      product: {
        id: "gid://shopify/Product/1",
        offer: offer ? { value: JSON.stringify(offer) } : null,
      },
    },
  };
}

describe("run", () => {
  it("does nothing without a config", () => {
    const result = run({ cart: { lines: [line(3)] }, discountNode: { config: null } });
    expect(result.discounts).toHaveLength(0);
  });

  it("does nothing below the first tier", () => {
    expect(run(cart([line(1)])).discounts).toHaveLength(0);
  });

  it("discounts exactly what the widget promised", () => {
    const result = run(cart([line(2)]));
    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0].value.fixedAmount.amount).toBe("3.98");
    expect(result.discounts[0].targets[0].cartLine.id).toBe("gid://shopify/CartLine/1");
  });

  it("moves up to the higher tier", () => {
    expect(run(cart([line(3)])).discounts[0].value.fixedAmount.amount).toBe("8.95");
  });

  it("ignores products the offer does not target", () => {
    const other = { ...OFFER, id: "off_other" };
    expect(run(cart([line(3, { offer: other })])).discounts).toHaveLength(0);
    expect(run(cart([line(3, { offer: null })])).discounts).toHaveLength(0);
  });

  it("survives a corrupt metafield instead of failing the checkout", () => {
    const input = {
      cart: { lines: [line(3)] },
      discountNode: { config: { value: "{not json" } },
    };
    expect(() => run(input)).not.toThrow();
    expect(run(input).discounts).toHaveLength(0);
  });

  it("agrees with the app's pricing core", () => {
    const cents = lineDiscountCents(1990, 2, OFFER.tiers);
    expect(cents).toBe(398);
    expect(priceTier(1990, OFFER.tiers[0]).total).toBe(3582);
  });
});
