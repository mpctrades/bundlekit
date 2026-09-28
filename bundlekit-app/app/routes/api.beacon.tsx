import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/**
 * Storefront beacon (F9), reached through the app proxy so Shopify signs it.
 * Fire-and-forget: the widget never waits for this, and a failure here must
 * never affect a product page.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) return new Response(null, { status: 401 });

  let offerId: unknown;
  let event: unknown;
  try {
    ({ offerId, event } = (await request.json()) as { offerId?: unknown; event?: unknown });
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof offerId !== "string" || (event !== "view" && event !== "select")) {
    return new Response(null, { status: 400 });
  }

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);

  const offer = await prisma.offer.findFirst({
    where: { id: offerId, shop: { domain: session.shop } },
    select: { id: true },
  });
  if (!offer) return new Response(null, { status: 204 });

  const field = event === "select" ? "selects" : "views";
  await prisma.offerStat.upsert({
    where: { offerId_day: { offerId: offer.id, day } },
    create: { offerId: offer.id, day, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });

  return new Response(null, { status: 204 });
};
