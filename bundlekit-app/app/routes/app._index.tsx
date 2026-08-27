import { BlockStack, Box, Button, EmptyState, Icon, InlineGrid, InlineStack, Layout, Page, Text } from "@shopify/polaris";
import { CashDollarIcon, ChartVerticalIcon, LiveIcon, OrderIcon } from "@shopify/polaris-icons";
import { motion } from "motion/react";
import { useLoaderData, useNavigate } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop, syncShopInfo } from "../lib/shop.server";
import { bucketByDay, deriveRateMetrics, fetchStatsForRange, summarizeByOffer, totalStats } from "../lib/stats.server";
import { findFunctionId } from "../lib/offers.server";
import { formatMoney } from "../lib/format";
import { Chart } from "../components/Chart";
import { KpiCard } from "../components/KpiCard";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  // Best-effort: the store's real currency, not the schema default. Never
  // let a sync hiccup block the dashboard from loading.
  const syncedCurrency = await syncShopInfo(admin, shop.id).catch((error) => {
    console.warn("[bundlekit] shop info sync failed", error);
    return undefined;
  });
  const currency = syncedCurrency ?? shop.currency;

  const [offerCount, liveCount, rows] = await Promise.all([
    prisma.offer.count({ where: { shopId: shop.id } }),
    prisma.offer.count({ where: { shopId: shop.id, status: "live" } }),
    fetchStatsForRange(shop.id, 30),
  ]);

  // findFunctionId throws when no Function is deployed yet — correct for a
  // real publish, but this is only a health check, so reduce to a boolean.
  let functionDeployed = true;
  try {
    await findFunctionId(admin);
  } catch {
    functionDeployed = false;
  }

  const totals = totalStats(rows);

  return {
    shopDomain: session.shop,
    currency,
    accent: shop.defaultAccent,
    offerCount,
    liveCount,
    functionDeployed,
    totals,
    rates: deriveRateMetrics(totals),
    buckets: bucketByDay(rows, 30),
    topOffers: summarizeByOffer(rows).slice(0, 5),
    greeting: greeting(new Date().getHours()),
  };
};

export default function Dashboard() {
  const {
    shopDomain,
    currency,
    accent,
    offerCount,
    liveCount,
    functionDeployed,
    totals,
    rates,
    buckets,
    topOffers,
    greeting: timeGreeting,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const themeEditor = `https://${shopDomain}/admin/themes/current/editor?template=product`;

  const healthChecks = [
    { label: "Publish an offer", done: liveCount > 0 },
    { label: "Activate automatic discounts", done: functionDeployed },
    { label: "Add BundleKit to your product page", done: false, manual: true },
  ];
  const doneCount = healthChecks.filter((item) => item.done).length;
  const allHealthy = doneCount === healthChecks.length;
  const nextStep = healthChecks.find((item) => !item.done);
  const hasRevenueData = totals.revenue > 0 || totals.orders > 0;
  const { conversionRate, aov } = rates;

  if (offerCount === 0) {
    return (
      <Page>
        <BlockStack gap="500">
          <PageHeader eyebrow="Overview" title={`${timeGreeting} 👋`} subtitle="Here's how your BundleKit offers are performing." />
          <Panel padding="0px">
            <EmptyState
              heading="Create your first offer"
              action={{ content: "Create offer", onAction: () => navigate("/app/offers/new") }}
              secondaryAction={{ content: "Place the block in your theme", url: themeEditor, target: "_blank" }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Once you publish an offer, its revenue, orders and views show up here in real time. Nothing here is
                sample data.
              </p>
            </EmptyState>
          </Panel>
        </BlockStack>
      </Page>
    );
  }

  const cards = [
    { label: "Bundle revenue (30d)", value: totals.revenue, format: (v: number) => formatMoney(v, currency), icon: CashDollarIcon, tint: "#008060", onClick: () => navigate("/app/analytics") },
    { label: "Bundle orders (30d)", value: totals.orders, format: (v: number) => String(Math.round(v)), icon: OrderIcon, tint: "#5C6AC4", onClick: () => navigate("/app/analytics") },
    {
      label: "Conversion rate (30d)",
      value: conversionRate ?? 0,
      format: (v: number) => (conversionRate === null ? "—" : `${v.toFixed(1)}%`),
      icon: ChartVerticalIcon,
      tint: "#006FBB",
      onClick: () => navigate("/app/analytics"),
    },
    {
      label: "Avg. order value (30d)",
      value: aov ?? 0,
      format: (v: number) => (aov === null ? "—" : formatMoney(v, currency)),
      icon: CashDollarIcon,
      tint: accent,
      onClick: () => navigate("/app/analytics"),
    },
  ];

  const checklistLinks: Partial<Record<string, () => void>> = {
    "Publish an offer": () => navigate("/app/offers"),
    "Add BundleKit to your product page": () => window.open(themeEditor, "_blank"),
  };

  return (
    <Page>
      <BlockStack gap="500">
        <PageHeader
          eyebrow="Overview"
          title={`${timeGreeting} 👋`}
          subtitle="Here's how your BundleKit offers are performing."
          action={
            <Button variant="primary" onClick={() => navigate("/app/offers/new")}>
              Create offer
            </Button>
          }
        />

        <InlineStack gap="200" blockAlign="center">
          <Box
            background={liveCount > 0 ? "bg-fill-success-secondary" : "bg-fill-secondary"}
            borderRadius="full"
            paddingInline="300"
            paddingBlock="100"
          >
            <InlineStack gap="150" blockAlign="center">
              <Icon source={LiveIcon} tone={liveCount > 0 ? "success" : "subdued"} />
              <Text as="span" variant="bodySm" fontWeight="medium">
                {liveCount} of {offerCount} offer{offerCount === 1 ? "" : "s"} live
              </Text>
            </InlineStack>
          </Box>
          <Button variant="plain" onClick={() => navigate("/app/offers")}>
            View offers
          </Button>
        </InlineStack>

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          {cards.map((card, index) => (
            <KpiCard
              key={card.label}
              label={card.label}
              value={card.value}
              format={card.format}
              icon={card.icon}
              tint={card.tint}
              delay={index * 0.05}
              onClick={card.onClick}
            />
          ))}
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
              <Panel>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Revenue, last 30 days
                  </Text>
                  {hasRevenueData ? (
                    <Chart
                      labels={buckets.map((bucket) => bucket.day)}
                      series={[{ label: "Revenue", color: accent, values: buckets.map((bucket) => bucket.revenue) }]}
                      formatValue={(value) => formatMoney(value, currency)}
                      formatLabel={(label) => new Date(`${label}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    />
                  ) : (
                    <Box padding="800">
                      <BlockStack gap="300" inlineAlign="center">
                        <Text as="p" tone="subdued" alignment="center">
                          No bundle revenue yet. Your analytics will appear after shoppers interact with a live offer.
                        </Text>
                        <Button onClick={() => navigate("/app/offers")}>View live offers</Button>
                      </BlockStack>
                    </Box>
                  )}
                </BlockStack>
              </Panel>
            </motion.div>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
              <Panel>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      BundleKit setup
                    </Text>
                    {!allHealthy ? (
                      <Box background="bg-fill-caution-secondary" borderRadius="full" paddingInline="300" paddingBlock="100">
                        <Text as="span" variant="bodySm" fontWeight="semibold">
                          {doneCount} of {healthChecks.length} complete
                        </Text>
                      </Box>
                    ) : null}
                  </InlineStack>

                  {allHealthy ? (
                    <BlockStack gap="200">
                      <InlineStack gap="300" blockAlign="center" wrap={false}>
                        <Text as="span" variant="headingMd">🎉</Text>
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          BundleKit is ready to sell
                        </Text>
                      </InlineStack>
                      <Text as="p" tone="subdued" variant="bodySm">
                        Your offers are active on your storefront.
                      </Text>
                    </BlockStack>
                  ) : (
                    <BlockStack gap="300">
                      {healthChecks.map((item) => {
                        const onItemClick = checklistLinks[item.label];
                        return (
                          <InlineStack
                            key={item.label}
                            gap="300"
                            blockAlign="center"
                            wrap={false}
                            {...(onItemClick
                              ? {
                                  onClick: onItemClick,
                                  role: "button" as const,
                                  tabIndex: 0,
                                  style: { cursor: "pointer" },
                                }
                              : {})}
                          >
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                minWidth: 24,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: item.done ? "rgba(0,128,96,0.12)" : "rgba(180,120,0,0.12)",
                              }}
                            >
                              {item.done ? (
                                <span style={{ width: 14, height: 14, display: "inline-flex" }}>
                                  <svg viewBox="0 0 20 20" fill="none" style={{ width: "100%", height: "100%" }}>
                                    <path d="M4 10l4 4 8-8" stroke="#008060" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </span>
                              ) : (
                                <Text as="span" variant="bodySm" fontWeight="bold">
                                  <span style={{ color: "#B47800" }}>!</span>
                                </Text>
                              )}
                            </div>
                            <Text as="span" variant="bodySm" tone={item.done ? undefined : "subdued"}>
                              {item.label}
                            </Text>
                            {onItemClick ? (
                              <span style={{ marginLeft: "auto", color: "rgba(0,0,0,0.3)", fontSize: 12 }}>›</span>
                            ) : null}
                          </InlineStack>
                        );
                      })}

                      {nextStep ? (
                        <Button
                          variant="primary"
                          fullWidth
                          onClick={
                            nextStep.label === "Publish an offer"
                              ? () => navigate("/app/offers")
                              : nextStep.label === "Add BundleKit to your product page"
                                ? () => window.open(themeEditor, "_blank")
                                : () => navigate("/app/help")
                          }
                        >
                          Continue setup
                        </Button>
                      ) : null}
                    </BlockStack>
                  )}
                </BlockStack>
              </Panel>
            </motion.div>
          </Layout.Section>
        </Layout>

        {topOffers.length > 0 ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }}>
            <Panel>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Top offers
                  </Text>
                  <Button variant="plain" onClick={() => navigate("/app/offers")}>
                    View all offers
                  </Button>
                </InlineStack>
                <BlockStack gap="200">
                  {topOffers.map((offer) => (
                    <InlineStack key={offer.offerId} align="space-between" blockAlign="center">
                      <Button variant="plain" onClick={() => navigate(`/app/offers/${offer.offerId}`)}>
                        {offer.name}
                      </Button>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {formatMoney(offer.revenue, currency)} · {offer.orders} orders
                      </Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Panel>
          </motion.div>
        ) : null}
      </BlockStack>
    </Page>
  );
}
