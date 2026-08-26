import { Badge, BlockStack, Box, Button, InlineStack, Layout, Page, ProgressBar, Text } from "@shopify/polaris";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../lib/shop.server";
import { getActivePlan, getPricingPlansUrl } from "../lib/billing.server";
import { getOfferLimit, PLANS, type PlanKey } from "../lib/billing";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const [plan, offerCount] = await Promise.all([
    getActivePlan(admin),
    prisma.offer.count({ where: { shopId: shop.id } }),
  ]);

  return {
    plan,
    offerCount,
    pricingPlansUrl: getPricingPlansUrl(session.shop),
  };
};

const PLAN_FEATURES: Record<PlanKey, string[]> = {
  free: ["3 live offers", "Quantity discounts", "EN + FR storefront"],
  grow: ["10 live offers", "Everything in Free", "Full analytics dashboard", "14-day free trial"],
  pro: ["Unlimited offers", "Everything in Grow", "Priority support", "14-day free trial"],
};

const PLAN_PRICE: Record<PlanKey, string> = {
  free: "$0",
  grow: "$4.99",
  pro: "$9.99",
};

export default function Billing() {
  const { plan, offerCount, pricingPlansUrl } = useLoaderData<typeof loader>();
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
            <InlineStack gap="400" wrap={false}>
              {(Object.keys(PLANS) as PlanKey[]).map((key) => (
                <Box key={key} width="33%">
                  <Panel>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h3" variant="headingMd">{PLANS[key].name}</Text>
                        {plan === key ? <Badge tone="success">Current</Badge> : null}
                      </InlineStack>
                      <Text as="p" variant="headingLg">
                        {PLAN_PRICE[key]}
                        <Text as="span" tone="subdued" variant="bodySm"> / month</Text>
                      </Text>
                      <BlockStack gap="150">
                        {PLAN_FEATURES[key].map((feature) => (
                          <Text as="p" variant="bodySm" key={feature}>· {feature}</Text>
                        ))}
                      </BlockStack>
                      {plan !== key ? (
                        <Button url={pricingPlansUrl} target="_top" fullWidth>
                          {key === "free" ? "Downgrade" : "Select"}
                        </Button>
                      ) : null}
                    </BlockStack>
                  </Panel>
                </Box>
              ))}
            </InlineStack>
          </Layout.Section>

          <Layout.Section>
            <Panel>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Why am I leaving the app?</Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Plan selection is hosted by Shopify for security and consistency — you'll come right
                  back to BundleKit once your plan is active. All plans can be cancelled anytime from
                  your Shopify admin.
                </Text>
              </BlockStack>
            </Panel>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
