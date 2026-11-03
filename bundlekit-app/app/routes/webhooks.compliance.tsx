import type { ActionFunctionArgs } from "react-router";
import { verifyWebhook } from "../lib/webhook.server";
import prisma from "../db.server";

/**
 * GDPR endpoints. BundleKit stores no customer data at all — offers, stats and
 * a shop row, nothing else — so data_request and customers/redact are no-ops we
 * acknowledge honestly, and shop/redact drops the shop and its sessions.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await verifyWebhook(request);

  if (topic === "SHOP_REDACT") {
    await prisma.session.deleteMany({ where: { shop } });
    await prisma.shop.deleteMany({ where: { domain: shop } });
  }
  return new Response();
};
