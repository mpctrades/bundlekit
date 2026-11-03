import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifiedWebhook {
  shop: string;
  /** Same shape as authenticate.webhook's `topic`, e.g. "ORDERS_CREATE". */
  topic: string;
  webhookId: string | undefined;
  payload: Record<string, unknown>;
}

/**
 * HMAC-only webhook check, for handlers that never call the Admin API.
 *
 * authenticate.webhook() also loads the shop's offline session and, once the
 * expiring token is past its hour, refreshes it with a round trip to Shopify
 * before the handler even runs. orders/create, compliance and app/uninstalled
 * don't use that session, and that work pushed their P90 to ~2.8s against
 * Shopify's 5s webhook timeout. The signature check is the same one the
 * library does (base64 HMAC-SHA256 of the raw body with the app secret).
 */
export async function verifyWebhook(
  request: Request,
  secret = process.env.SHOPIFY_API_SECRET || "",
): Promise<VerifiedWebhook> {
  if (request.method !== "POST") throw new Response(undefined, { status: 405 });

  const hmac = request.headers.get("x-shopify-hmac-sha256");
  const shop = request.headers.get("x-shopify-shop-domain");
  const topic = request.headers.get("x-shopify-topic");
  if (!hmac || !shop || !topic) throw new Response(undefined, { status: 400 });

  const rawBody = await request.text();
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const received = Buffer.from(hmac, "base64");
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Response(undefined, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Response(undefined, { status: 400 });
  }

  return {
    shop,
    topic: topic.toUpperCase().replace(/[/.]/g, "_"),
    webhookId: request.headers.get("x-shopify-webhook-id") ?? undefined,
    payload,
  };
}
