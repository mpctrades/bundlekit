import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhook } from "./webhook.server";

const SECRET = "test-secret";
const body = JSON.stringify({ id: 1, line_items: [] });
const sign = (raw: string, secret = SECRET) => createHmac("sha256", secret).update(raw, "utf8").digest("base64");

function webhook(headers: Record<string, string>, raw = body, method = "POST") {
  return new Request("https://example.test/webhooks/orders/create", {
    method,
    headers: {
      "x-shopify-shop-domain": "demo.myshopify.com",
      "x-shopify-topic": "orders/create",
      "x-shopify-webhook-id": "abc-123",
      ...headers,
    },
    body: method === "POST" ? raw : undefined,
  });
}

async function status(promise: Promise<unknown>) {
  try {
    await promise;
    return 200;
  } catch (error) {
    return (error as Response).status;
  }
}

describe("verifyWebhook", () => {
  it("accepts a correctly signed delivery", async () => {
    const result = await verifyWebhook(webhook({ "x-shopify-hmac-sha256": sign(body) }), SECRET);
    expect(result).toEqual({
      shop: "demo.myshopify.com",
      topic: "ORDERS_CREATE",
      webhookId: "abc-123",
      payload: { id: 1, line_items: [] },
    });
  });

  it("normalizes compliance topics like the library does", async () => {
    const request = webhook({ "x-shopify-hmac-sha256": sign(body), "x-shopify-topic": "shop/redact" });
    expect((await verifyWebhook(request, SECRET)).topic).toBe("SHOP_REDACT");
  });

  it("rejects a wrong signature, a tampered body and a wrong secret with 401", async () => {
    expect(await status(verifyWebhook(webhook({ "x-shopify-hmac-sha256": sign(body, "other") }), SECRET))).toBe(401);
    expect(await status(verifyWebhook(webhook({ "x-shopify-hmac-sha256": sign(body) }, body + " "), SECRET))).toBe(401);
    expect(await status(verifyWebhook(webhook({ "x-shopify-hmac-sha256": "short" }), SECRET))).toBe(401);
    expect(await status(verifyWebhook(webhook({ "x-shopify-hmac-sha256": sign(body, "") }), ""))).toBe(401);
  });

  it("rejects missing headers with 400 and non-POST with 405", async () => {
    expect(await status(verifyWebhook(webhook({}), SECRET))).toBe(400);
    expect(await status(verifyWebhook(webhook({ "x-shopify-hmac-sha256": sign(body) }, body, "GET"), SECRET))).toBe(405);
  });
});
