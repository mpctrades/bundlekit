import { Badge, Banner, BlockStack, Button, InlineStack, Layout, Page, ProgressBar, Text } from "@shopify/polaris";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../lib/shop.server";
import { getActivePlan, getPricingPlansUrl } from "../lib/billing.server";
import { getOfferLimit, PLANS, PLAN_FEATURES, PLAN_PRICE, type PlanKey } from "../lib/billing";
import { friendlyErrorMessage } from "../lib/errors";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";
import { PricingCard } from "../components/PricingCard";

// The one plan to call out with the subtle orange "Most popular" accent —
// per the brief, exactly one plan, never the current plan's own summary.
const POPULAR_PLAN: PlanKey = "grow";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const pricingPlansUrl = getPricingPlansUrl(session.shop);

  // getActivePlan() already fails open to "free" internally — the only
  // remaining risk here is Postgres (getOrCreateShop / the offer count).
  try {
    const shop = await getOrCreateShop(session.shop);
    const [plan, offerCount] = await Promise.all([
      getActivePlan(admin),
      prisma.offer.count({ where: { shopId: shop.id } }),
    ]);

    return { plan, offerCount, pricingPlansUrl, error: null as string | null };
  } catch (error) {
    console.error("[bundlekit] billing loader failed", error);
    return { plan: "free" as PlanKey, offerCount: 0, pricingPlansUrl, error: friendlyErrorMessage(error) };
  }
};

export default function Billing() {
  const { plan, offerCount, pricingPlansUrl, error } = useLoaderData<typeof loader>();
  const limit = getOfferLimit(plan);
  const usagePct = Number.isFinite(limit) ? Math.min(100, (offerCount / limit) * 100) : 0;

  return (
    <Page>
      <BlockStack gap="500">
        <PageHeader
          eyebrow="Plans & billing"
          title="Plans & billing"
          subtitle="Your current plan, usage, and how to change it."
        />

        {error ? (
          <Banner tone="critical" title="Couldn't load your current plan">
            {error} Showing the Free plan as a placeholder — your actual plan and usage may differ.
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section variant="oneThird">
            <Panel>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Current plan</Text>
                  <Badge tone={plan === "free" ? undefined : "success"}>{PLANS[plan].name}</Badge>
                </InlineStack>
                <Text as="p" tone="subdued" variant="bodySm">
                  {Number.isFinite(limit)
                    ? `${offerCount} of ${limit} offers used`
                    : `${offerCount} offers — unlimited on this plan`}
                </Text>
                {Number.isFinite(limit) ? <ProgressBar progress={usagePct} tone={usagePct >= 100 ? "critical" : "primary"} /> : null}
                <Button url={pricingPlansUrl} target="_top" variant="primary">
                  {plan === "free" ? "Choose a plan" : "Change plan"}
                </Button>
              </BlockStack>
            </Panel>
          </Layout.Section>

          <Layout.Section>
            <div className="bk-pricing-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
              <style>{`
                @media (max-width: 900px) { .bk-pricing-grid { grid-template-columns: repeat(2, 1fr) !important; } }
                @media (max-width: 620px) { .bk-pricing-grid { grid-template-columns: 1fr !important; } }
              `}</style>
              {(Object.keys(PLANS) as PlanKey[]).map((key) => (
                <PricingCard
                  key={key}
                  name={PLANS[key].name}
                  price={PLAN_PRICE[key]}
                  features={PLAN_FEATURES[key]}
                  isCurrent={plan === key}
                  isPopular={key === POPULAR_PLAN}
                  actionLabel={key === "free" ? "Downgrade" : "Start free trial"}
                  actionUrl={pricingPlansUrl}
                />
              ))}
            </div>
          </Layout.Section>

          <Layout.Section>
            <Panel>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Secure Shopify billing</Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Plan selection and billing are securely handled by Shopify. You'll return to BundleKit
                  automatically after completing your selection.
                </Text>
              </BlockStack>
            </Panel>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
