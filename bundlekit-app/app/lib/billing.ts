/**
 * Shopify Managed Pricing plans, configured in the Partner Dashboard (App
 * setup > Pricing) — not in code. The `name` here must match the plan name
 * exactly as typed there; that's the only thing tying an AppSubscription
 * back to one of these tiers.
 *
 * "free" has no Partner Dashboard plan — it's simply what a shop is on
 * before it has any active subscription.
 *
 * Plain (non-`.server`) module: this metadata is rendered directly in the
 * billing page's component, so it must be safe to bundle for the client —
 * unlike the live GraphQL lookup in `billing.server.ts`.
 */
export const PLANS = {
  free: { key: "free", name: "Free", offerLimit: 2 },
  pro: { key: "pro", name: "Pro", offerLimit: 25 },
  plus: { key: "plus", name: "Plus", offerLimit: Infinity },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getOfferLimit(plan: PlanKey): number {
  return PLANS[plan].offerLimit;
}
