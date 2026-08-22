import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/**
 * GDPR endpoints. BundleKit stores no customer data at all — offers, stats and
 * a shop row, nothing else — so data_request and customers/redact are no-ops we
 * acknowledge honestly, and shop/redact drops the shop.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  if (topic === "SHOP_REDACT") {
    await prisma.shop.deleteMany({ where: { domain: shop } });
  }
  return new Response();
};
