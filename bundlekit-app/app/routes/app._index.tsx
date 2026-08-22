import { BlockStack, Box, Button, EmptyState, InlineGrid, InlineStack, Layout, Page, Text } from "@shopify/polaris";
import { CashDollarIcon, LiveIcon, OrderIcon, ViewIcon } from "@shopify/polaris-icons";
import { motion } from "motion/react";
import { useLoaderData, useNavigate } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop, syncShopInfo } from "../lib/shop.server";
import { bucketByDay, fetchStatsForRange, summarizeByOffer, totalStats } from "../lib/stats.server";
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

  return {
    shopDomain: session.shop,
    currency,
    accent: shop.defaultAccent,
    offerCount,
    liveCount,
    functionDeployed,
    totals: totalStats(rows),
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
    buckets,
    topOffers,
    greeting: timeGreeting,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const themeEditor = `https://${shopDomain}/admin/themes/current/editor?template=product`;

  const healthChecks = [
    { label: "Function active", done: functionDeployed },
    { label: "Offer published", done: liveCount > 0 },
    { label: "Theme block added", done: false, manual: true },
  ];
  const doneCount = healthChecks.filter((item) => item.done).length;
  const allHealthy = doneCount === healthChecks.length;
  const nextStep = healthChecks.find((item) => !item.done);
  const hasRevenueData = totals.revenue > 0 || totals.orders > 0;

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
    { label: "Revenue (30d)", value: totals.revenue, format: (v: number) => formatMoney(v, currency), icon: CashDollarIcon, tint: "#008060", onClick: () => navigate("/app/analytics") },
    { label: "Orders (30d)", value: totals.orders, format: (v: number) => String(Math.round(v)), icon: OrderIcon, tint: "#5C6AC4", onClick: () => navigate("/app/analytics") },
    { label: "Widget views (30d)", value: totals.views, format: (v: number) => String(Math.round(v)), icon: ViewIcon, tint: "#006FBB", onClick: () => navigate("/app/analytics") },
    { label: "Live offers", value: liveCount, format: (v: number) => `${Math.round(v)} / ${offerCount}`, icon: LiveIcon, tint: accent, onClick: () => navigate("/app/offers") },
  ];

  const checklistLinks: Partial<Record<string, () => void>> = {
    "Offer published": () => navigate("/app/offers"),
    "Theme block added": () => window.open(themeEditor, "_blank"),
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
                    <BlockStack gap="050">
                      <Text as="h2" variant="headingMd">
                        BundleKit Health
                      </Text>
                      <Text as="p" tone="subdued" variant="bodySm">
                        Everything BundleKit needs to sell
                      </Text>
                    </BlockStack>
                    {!allHealthy ? (
                      <Box background="bg-fill-caution-secondary" borderRadius="full" paddingInline="300" paddingBlock="100">
                        <Text as="span" variant="bodySm" fontWeight="semibold">
                          {doneCount}/{healthChecks.length}
                        </Text>
                      </Box>
                    ) : null}
                  </InlineStack>

                  {allHealthy ? (
                    <InlineStack gap="300" blockAlign="center" wrap={false}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          minWidth: 28,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(0,128,96,0.12)",
                        }}
                      >
                        <span style={{ width: 15, height: 15, display: "inline-flex" }}>
                          <svg viewBox="0 0 20 20" fill="none" style={{ width: "100%", height: "100%" }}>
                            <path d="M4 10l4 4 8-8" stroke="#008060" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </div>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        BundleKit is ready ✓
                      </Text>
                    </InlineStack>
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
                        <Box background="bg-fill-caution-secondary" borderRadius="200" padding="300">
                          <BlockStack gap="200">
                            <Text as="p" variant="bodySm">
                              {nextStep.label === "Function active"
                                ? "BundleKit isn't ready yet. Deploy the discount Function to continue."
                                : nextStep.label === "Offer published"
                                  ? "BundleKit is almost ready. Publish an offer to start selling."
                                  : "BundleKit is almost ready. Add the BundleKit block to your product template."}
                            </Text>
                            {nextStep.label === "Theme block added" ? (
                              <Button url={themeEditor} target="_blank">
                                Add BundleKit to theme
                              </Button>
                            ) : nextStep.label === "Offer published" ? (
                              <Button onClick={() => navigate("/app/offers")}>Go to offers</Button>
                            ) : null}
                          </BlockStack>
                        </Box>
                      ) : null}
                    </BlockStack>
                  )}

                  <Button url={themeEditor} target="_blank" fullWidth>
                    Open the theme editor
                  </Button>
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
