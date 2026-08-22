import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/**
 * Revenue attribution (F9). A line the widget added carries a `_bundlekit`
 * property holding the offer id; we count the order once and add up the lines
 * that came from it. No customer data is read or stored.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);
  const lines = (payload.line_items ?? []) as Array<{
    price: string;
    quantity: number;
    properties?: Array<{ name: string; value: string }>;
  }>;

  const byOffer = new Map<string, number>();
  for (const line of lines) {
    const tag = line.properties?.find((property) => property.name === "_bundlekit");
    if (!tag) continue;
    const revenue = Number(line.price) * line.quantity;
    byOffer.set(tag.value, (byOffer.get(tag.value) ?? 0) + revenue);
  }
  if (!byOffer.size) return new Response();

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);

  for (const [offerId, revenue] of byOffer) {
    const offer = await prisma.offer.findFirst({
      where: { id: offerId, shop: { domain: shop } },
      select: { id: true },
    });
    if (!offer) continue;

    await prisma.offerStat.upsert({
      where: { offerId_day: { offerId: offer.id, day } },
      create: { offerId: offer.id, day, orders: 1, revenue },
      update: { orders: { increment: 1 }, revenue: { increment: revenue } },
    });
  }
  return new Response();
};
