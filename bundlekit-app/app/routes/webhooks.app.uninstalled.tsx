import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/**
 * Uninstall safety: Shopify deactivates our automatic discounts by itself and
 * the theme block disappears with the app, because we never wrote into the
 * theme. All that is left for us is to forget the shop.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`[bundlekit] ${topic} for ${shop}`);

  // Unconditional: Shopify retries this webhook, and a retry arrives after
  // the session is already gone — the shop row must still be cleaned up.
  await prisma.session.deleteMany({ where: { shop } });
  await prisma.shop.deleteMany({ where: { domain: shop } }); // cascades offers + stats
  return new Response();
};
