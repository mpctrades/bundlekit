import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export async function getOrCreateShop(domain: string) {
  return prisma.shop.upsert({
    where: { domain },
    create: { domain },
    update: {},
  });
}

const SHOP_INFO = `#graphql
  query ShopInfo {
    shop { currencyCode }
  }`;

/**
 * Real currency, not the schema default. There's no webhook for "merchant
 * changed store currency", so this re-checks on every Dashboard visit
 * rather than only at install time. Must never break the page it's called
 * from — callers wrap this in .catch(), same as ensureMetafieldDefinition
 * in offers.server.ts.
 *
 * Locale sync was dropped: the only way to read a shop's primary locale is
 * the `shopLocales` query, which needs the `read_locales` scope. Adding a
 * scope just for this isn't worth the re-consent it forces on merchants —
 * primaryLocale stays whatever it was set to (the "en" schema default).
 */
export async function syncShopInfo(admin: AdminApiContext, shopId: string): Promise<string | undefined> {
  const response = await admin.graphql(SHOP_INFO);
  const body = await response.json();
  const currency: string | undefined = body.data?.shop?.currencyCode;

  if (!currency) return undefined;

  await prisma.shop.update({ where: { id: shopId }, data: { currency } });
  return currency;
}
