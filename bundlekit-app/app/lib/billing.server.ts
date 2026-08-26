import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { PLANS, type PlanKey } from "./billing";

const NAME_TO_PLAN: Record<string, PlanKey> = Object.fromEntries(
  Object.values(PLANS).map((plan) => [plan.name, plan.key as PlanKey]),
);

const ACTIVE_SUBSCRIPTION = `#graphql
  query ActiveSubscription {
    currentAppInstallation {
      activeSubscriptions {
        name
        status
        test
      }
    }
  }`;

/**
 * Reads the shop's plan straight from its live Shopify AppSubscription —
 * Managed Pricing still creates one of these under the hood — rather than
 * caching it locally. There's no webhook for plan changes any more (Shopify
 * dropped APP_SUBSCRIPTIONS_UPDATE for Managed Pricing apps), so a live read
 * is the only way this doesn't silently go stale after an upgrade/downgrade.
 * Falls back to "free" on any lookup failure — a billing check must never
 * be the thing that breaks the offer builder.
 */
export async function getActivePlan(admin: AdminApiContext): Promise<PlanKey> {
  try {
    const response = await admin.graphql(ACTIVE_SUBSCRIPTION);
    const body = await response.json();
    const subscriptions = body.data?.currentAppInstallation?.activeSubscriptions ?? [];
    const active = subscriptions.find((sub: { status: string }) => sub.status === "ACTIVE");
    if (!active) return "free";
    return NAME_TO_PLAN[active.name] ?? "free";
  } catch {
    return "free";
  }
}

/**
 * Managed Pricing's plan-selection page is Shopify-hosted, not part of this
 * app — merchants leave the embedded iframe entirely (hence target="_top"
 * wherever this is used). SHOPIFY_APP_HANDLE must match the app handle shown
 * in the Partner Dashboard; it's a separate value from the app name.
 */
export function getPricingPlansUrl(shopDomain: string): string {
  const storeHandle = shopDomain.replace(/\.myshopify\.com$/, "");
  const appHandle = process.env.SHOPIFY_APP_HANDLE || "bundlekit";
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}
