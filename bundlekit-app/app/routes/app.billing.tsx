import { Banner, BlockStack, InlineStack, Page, Text } from "@shopify/polaris";
import { motion } from "motion/react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../lib/shop.server";
import { getActivePlan, getPricingPlansUrl } from "../lib/billing.server";
import { fetchStatsForRange, totalStats } from "../lib/stats.server";
import { getOfferLimit, PLANS, PLAN_FEATURES, PLAN_PRICE, PLAN_TAGLINE, TRIAL_DAYS, type PlanKey } from "../lib/billing";
import { friendlyErrorMessage } from "../lib/errors";
import { formatMoney } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { PricingCard } from "../components/PricingCard";

// Exactly one plan gets the orange outline and "Most popular" chip.
const POPULAR_PLAN: PlanKey = "grow";
const ORDER: PlanKey[] = ["free", "grow", "pro"];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const pricingPlansUrl = getPricingPlansUrl(session.shop);

  // getActivePlan() already fails open to "free" internally — the only
  // remaining risk here is Postgres (getOrCreateShop / the counts).
  try {
    const shop = await getOrCreateShop(session.shop);
    const [plan, liveCount, draftCount, rows] = await Promise.all([
      getActivePlan(admin),
      // Plans cap live offers; drafts and paused offers don't count.
      prisma.offer.count({ where: { shopId: shop.id, status: "live" } }),
      prisma.offer.count({ where: { shopId: shop.id, status: { not: "live" } } }),
      fetchStatsForRange(shop.id, 30).catch(() => []),
    ]);
    const totals = totalStats(rows);
    return {
      plan,
      liveCount,
      draftCount,
      revenue: totals.revenue,
      orders: totals.orders,
      currency: shop.currency,
      pricingPlansUrl,
      error: null as string | null,
    };
  } catch (error) {
    console.error("[bundlekit] billing loader failed", error);
    return {
      plan: "free" as PlanKey,
      liveCount: 0,
      draftCount: 0,
      revenue: 0,
      orders: 0,
      currency: "USD",
      pricingPlansUrl,
      error: friendlyErrorMessage(error),
    };
  }
};

function actionLabel(target: PlanKey, current: PlanKey): string {
  if (target === "free") return "Downgrade to Free";
  if (current === "free") return `Start ${TRIAL_DAYS}-day free trial`;
  const upgrade = ORDER.indexOf(target) > ORDER.indexOf(current);
  return `${upgrade ? "Upgrade" : "Switch"} to ${PLANS[target].name}`;
}

/** The plan we'd point a merchant to next: the one right above theirs. */
function suggestedPlan(current: PlanKey): PlanKey | null {
  const next = ORDER[ORDER.indexOf(current) + 1];
  return next ?? null;
}

function Stat({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="bk-stat">
      <div className="bk-stat__label">{label}</div>
      <div className="bk-stat__value">{value}</div>
      {children}
      {hint ? <div className="bk-stat__hint">{hint}</div> : null}
    </div>
  );
}

export default function Billing() {
  const { plan, liveCount, draftCount, revenue, orders, currency, pricingPlansUrl, error } = useLoaderData<typeof loader>();
  const limit = getOfferLimit(plan);
  const finite = Number.isFinite(limit);
  const usagePct = finite ? Math.min(100, (liveCount / limit) * 100) : 0;
  const atLimit = finite && liveCount >= limit;
  const suggested = suggestedPlan(plan);

  const usageHint = atLimit
    ? `You've used every live offer on ${PLANS[plan].name}. Upgrade to publish more.`
    : draftCount > 0
      ? `${draftCount} draft or paused offer${draftCount === 1 ? "" : "s"} — these don't count.`
      : "Drafts and paused offers don't count.";

  return (
    <Page>
      <BlockStack gap="500">
        <PageHeader
          eyebrow="Plans & billing"
          title="Plans & billing"
          subtitle="Simple monthly pricing. Change or cancel any time — billed through Shopify."
        />

        {error ? (
          <Banner tone="critical" title="Couldn't load your current plan">
            {error} Showing the Free plan as a placeholder — your actual plan and usage may differ.
          </Banner>
        ) : null}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className="bk-grid-3">
            <Stat
              label="Current plan"
              value={PLANS[plan].name}
              hint={plan === "free" ? `Paid plans start with a ${TRIAL_DAYS}-day free trial.` : `${PLAN_PRICE[plan]}/month, billed by Shopify.`}
            />
            <Stat label="Live offers" value={finite ? `${liveCount} / ${limit}` : `${liveCount} / Unlimited`} hint={usageHint}>
              {finite ? (
                <div className={`bk-meter${atLimit ? " bk-meter--full" : ""}`} aria-hidden>
                  <span style={{ width: `${usagePct}%` }} />
                </div>
              ) : null}
            </Stat>
            <Stat
              label="Bundle revenue (30 days)"
              value={formatMoney(revenue, currency)}
              hint={
                orders > 0
                  ? `From ${orders} order${orders === 1 ? "" : "s"} that used a BundleKit offer. Never billed — every plan is a flat price.`
                  : "Sales from BundleKit offers. Never billed — every plan is a flat price."
              }
            />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.25 }}>
          <div className="bk-grid-3" style={{ alignItems: "stretch" }}>
            {ORDER.map((key) => (
              <PricingCard
                key={key}
                name={PLANS[key].name}
                price={PLAN_PRICE[key]}
                tagline={PLAN_TAGLINE[key]}
                features={PLAN_FEATURES[key]}
                isCurrent={plan === key}
                isPopular={key === POPULAR_PLAN}
                actionLabel={actionLabel(key, plan)}
                actionUrl={pricingPlansUrl}
                primary={key === suggested}
              />
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.25 }}>
          <div className="bk-stat" style={{ padding: "18px 24px" }}>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">
                Prices in USD, billed every 30 days on your Shopify invoice. Plan changes open Shopify's secure plan
                page and bring you straight back here.
              </Text>
              <InlineStack gap="200" wrap>
                <span className="bk-chip bk-chip--neutral">Cancel any time</span>
                <span className="bk-chip bk-chip--neutral">Offers are never deleted when you change plan</span>
                <span className="bk-chip bk-chip--neutral">Drafts are always free</span>
              </InlineStack>
            </BlockStack>
          </div>
        </motion.div>
      </BlockStack>
    </Page>
  );
}
