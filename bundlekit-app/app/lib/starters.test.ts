import { describe, expect, it } from "vitest";
import { describeTiers, findStarter, parseStarterProductIds, rankBestSellers, STARTER_OFFERS } from "./starters";
import { normaliseTiers } from "./pricing";

describe("starter offers", () => {
  it("are all valid offers the builder can publish as-is", () => {
    for (const starter of STARTER_OFFERS) {
      expect(normaliseTiers(starter.tiers)).toEqual(starter.tiers);
      expect(starter.tiers.filter((tier) => tier.badge)).toHaveLength(1);
      expect(starter.name.length).toBeLessThanOrEqual(100);
    }
    expect(STARTER_OFFERS.filter((starter) => starter.recommended)).toHaveLength(1);
  });

  it("only resolves known template ids", () => {
    expect(findStarter("buy-2-save-10")?.tiers[0].value).toBe(10);
    expect(findStarter("nope")).toBeNull();
    expect(findStarter(null)).toBeNull();
  });

  it("describes tiers for the cards", () => {
    expect(describeTiers(findStarter("tiered-5-10-15")!.tiers)).toBe("Buy 2 → 5% off · Buy 3 → 10% off · Buy 4 → 15% off");
  });
});

describe("parseStarterProductIds", () => {
  it("accepts numeric ids and Product gids, dedupes, caps at 10", () => {
    expect(parseStarterProductIds("1, gid://shopify/Product/2,1")).toEqual(["gid://shopify/Product/1", "gid://shopify/Product/2"]);
    expect(parseStarterProductIds(Array.from({ length: 15 }, (_, i) => i + 1).join(","))).toHaveLength(10);
  });

  it("drops anything that isn't a product id", () => {
    expect(parseStarterProductIds("gid://shopify/Collection/3,abc,../x,<script>")).toEqual([]);
    expect(parseStarterProductIds(null)).toEqual([]);
  });
});

describe("rankBestSellers", () => {
  it("ranks by units ordered and skips lines without a product", () => {
    const lines = [
      { productId: "a", quantity: 1 },
      { productId: "b", quantity: 5 },
      { productId: null, quantity: 9 },
      { productId: "a", quantity: 2 },
      { productId: "c", quantity: 1 },
    ];
    expect(rankBestSellers(lines, 2)).toEqual(["b", "a"]);
  });
});
