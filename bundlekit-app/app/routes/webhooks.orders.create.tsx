import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/**
 * Revenue attribution (F9). A line the widget added carries a `_bundlekit`
 * property holding the offer id; we count the order once and add up the lines
 * that came from it. No customer data is read or stored.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, webhookId } = await authenticate.webhook(request);
  const lines = (payload.line_items ?? []) as Array<{
    price: string;
    quantity: number;
    properties?: Array<{ name: string; value: string }>;
    discount_allocations?: Array<{ amount: string }>;
  }>;

  const byOffer = new Map<string, number>();
  for (const line of lines) {
    const tag = line.properties?.find((property) => property.name === "_bundlekit");
    if (!tag) continue;
    // Net of discounts (the bundle's own and any stacked code), so Analytics
    // reports what the merchant actually took, not the pre-discount subtotal.
    const discount = (line.discount_allocations ?? []).reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    const revenue = Math.max(0, Number(line.price) * line.quantity - discount);
    byOffer.set(tag.value, (byOffer.get(tag.value) ?? 0) + revenue);
  }
  if (!byOffer.size) return new Response();

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);

  // At-least-once delivery: claim this delivery id, and count the order in
  // the same transaction. A retry hits the primary key and is acknowledged
  // without counting twice; a failure part-way rolls the claim back, so the
  // retry still counts it.
  try {
    await prisma.$transaction(async (tx) => {
      if (webhookId) await tx.processedWebhook.create({ data: { id: webhookId } });

      for (const [offerId, revenue] of byOffer) {
        const offer = await tx.offer.findFirst({
          where: { id: offerId, shop: { domain: shop } },
          select: { id: true },
        });
        if (!offer) continue;

        await tx.offerStat.upsert({
          where: { offerId_day: { offerId: offer.id, day } },
          create: { offerId: offer.id, day, orders: 1, revenue },
          update: { orders: { increment: 1 }, revenue: { increment: revenue } },
        });
      }
    });
  } catch (error) {
    // Only the delivery-id claim means "already counted". Any other unique
    // clash (two orders creating the same day's stat row at once) must fail
    // so Shopify retries it.
    if ((error as { code?: string }).code === "P2002" && webhookId) {
      const claimed = await prisma.processedWebhook.findUnique({ where: { id: webhookId }, select: { id: true } });
      if (claimed) return new Response();
    }
    throw error;
  }
  return new Response();
};
