import { useMemo, useState } from "react";
import { Banner, BlockStack, Box, ButtonGroup, Button, IndexTable, InlineGrid, InlineStack, Page, Text } from "@shopify/polaris";
import type { IndexTableProps } from "@shopify/polaris";
import { CashDollarIcon, CheckCircleIcon, OrderIcon, ViewIcon } from "@shopify/polaris-icons";
import { motion } from "motion/react";
import { Link, useLoaderData, useNavigate, useSearchParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../lib/shop.server";
import {
  bucketByDay,
  computeTrend,
  fetchStatsForPreviousRange,
  fetchStatsForRange,
  summarizeByOffer,
  totalStats,
} from "../lib/stats.server";
import { getFunctionId } from "../lib/offers.server";
import { friendlyErrorMessage } from "../lib/errors";
import { formatMoney } from "../lib/format";
import { themeEditorDeepLink } from "../lib/theme";
import { Chart } from "../components/Chart";
import { Funnel, type FunnelStage } from "../components/Funnel";
import { KpiCard } from "../components/KpiCard";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";
import { SetupChecklist } from "../components/SetupChecklist";

const RANGE_OPTIONS = [7, 30, 90];

// Schema defaults (prisma/schema.prisma Shop model) — used only when the
// shop's own data can't be read at all.
const FALLBACK_CURRENCY = "EUR";
const FALLBACK_ACCENT = "#FF4A1C";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("days"));
  const days = RANGE_OPTIONS.includes(requested) ? requested : 30;

  try {
    const shop = await getOrCreateShop(session.shop);
    const [rows, previousRows, liveCount, functionDeployed] = await Promise.all([
      fetchStatsForRange(shop.id, days),
      // Purely for the KPI cards' trend chips — never let a hiccup here
      // take down the numbers that matter.
      fetchStatsForPreviousRange(shop.id, days).catch((error) => {
        console.warn("[bundlekit] previous-period stats failed", error);
        return [];
      }),
      // For the empty state's setup checklist only — same check the
      // Dashboard already runs.
      prisma.offer.count({ where: { shopId: shop.id, status: "live" } }),
      getFunctionId(admin, shop).then(
        () => true,
        () => false,
      ),
    ]);
    const totals = totalStats(rows);
    const previousTotals = totalStats(previousRows);

    return {
      days,
      shopDomain: session.shop,
      currency: shop.currency,
      accent: shop.defaultAccent,
      liveCount,
      functionDeployed,
      totals,
      trends: {
        revenue: computeTrend(totals.revenue, previousTotals.revenue),
        orders: computeTrend(totals.orders, previousTotals.orders),
        views: computeTrend(totals.views, previousTotals.views),
        selects: computeTrend(totals.selects, previousTotals.selects),
      },
      buckets: bucketByDay(rows, days),
      perOffer: summarizeByOffer(rows),
      error: null as string | null,
    };
  } catch (error) {
    console.error("[bundlekit] analytics loader failed", error);
    return {
      days,
      shopDomain: session.shop,
      currency: FALLBACK_CURRENCY,
      accent: FALLBACK_ACCENT,
      liveCount: 0,
      functionDeployed: false,
      totals: totalStats([]),
      trends: { revenue: null, orders: null, views: null, selects: null },
      buckets: bucketByDay([], days),
      perOffer: [] as ReturnType<typeof summarizeByOffer>,
      error: friendlyErrorMessage(error),
    };
  }
};

const OFFER_TABLE_COLUMNS = ["name", "views", "selects", "orders", "conversion", "revenue"] as const;
type OfferTableColumn = (typeof OFFER_TABLE_COLUMNS)[number];

export default function Analytics() {
  const { days, shopDomain, currency, accent, liveCount, functionDeployed, totals, trends, buckets, perOffer, error } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const themeEditor = themeEditorDeepLink(shopDomain);
  const hasActivity = totals.views > 0 || totals.selects > 0 || totals.orders > 0;
  const [searchParams] = useSearchParams();
  const [sortColumnIndex, setSortColumnIndex] = useState(5); // Revenue, matching the server's default order
  const [sortDirection, setSortDirection] = useState<IndexTableProps["sortDirection"]>("descending");

  const perOfferWithConversion = useMemo(
    () => perOffer.map((offer) => ({ ...offer, conversion: offer.views > 0 ? (offer.orders / offer.views) * 100 : null })),
    [perOffer],
  );

  const sortedOffers = useMemo(() => {
    const column: OfferTableColumn = OFFER_TABLE_COLUMNS[sortColumnIndex] ?? "revenue";
    const direction = sortDirection === "ascending" ? 1 : -1;
    return [...perOfferWithConversion].sort((a, b) => {
      if (column === "name") return direction * a.name.localeCompare(b.name);
      const aValue = a[column] ?? -1;
      const bValue = b[column] ?? -1;
      return direction * (aValue - bValue);
    });
  }, [perOfferWithConversion, sortColumnIndex, sortDirection]);

  const handleSort = (headingIndex: number, direction: IndexTableProps["sortDirection"]) => {
    setSortColumnIndex(headingIndex);
    setSortDirection(direction);
  };

  const trendCompareLabel = `vs prior ${days}d`;
  const cards = [
    { label: `Revenue (${days}d)`, value: totals.revenue, format: (v: number) => formatMoney(v, currency), icon: CashDollarIcon, tint: "#008060", trend: trends.revenue },
    { label: `Orders (${days}d)`, value: totals.orders, format: (v: number) => String(Math.round(v)), icon: OrderIcon, tint: "#5C6AC4", trend: trends.orders },
    { label: `Widget views (${days}d)`, value: totals.views, format: (v: number) => String(Math.round(v)), icon: ViewIcon, tint: "#006FBB", trend: trends.views },
    { label: `Widget selections (${days}d)`, value: totals.selects, format: (v: number) => String(Math.round(v)), icon: CheckCircleIcon, tint: accent, trend: trends.selects },
  ];

  const selectionRate = totals.views > 0 ? (totals.selects / totals.views) * 100 : null;
  const orderRate = totals.selects > 0 ? (totals.orders / totals.selects) * 100 : null;
  const funnelStages: FunnelStage[] = [
    { label: "Widget views", value: String(Math.round(totals.views)) },
    {
      label: "Tier selections",
      value: String(Math.round(totals.selects)),
      sublabel: selectionRate !== null ? `${selectionRate.toFixed(1)}% selection rate` : undefined,
    },
    {
      label: "Bundle orders",
      value: String(Math.round(totals.orders)),
      sublabel: orderRate !== null ? `${orderRate.toFixed(1)}% of selections` : undefined,
    },
    { label: "Bundle revenue", value: formatMoney(totals.revenue, currency) },
  ];

  return (
    <Page>
      <BlockStack gap="500">
        <PageHeader
          eyebrow="Analytics"
          title="Analytics"
          subtitle="Real numbers from your published offers — no sample data."
          action={
            <ButtonGroup variant="segmented">
              {RANGE_OPTIONS.map((option) => (
                <Button
                  key={option}
                  pressed={option === days}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set("days", String(option));
                    navigate(`/app/analytics?${next.toString()}`);
                  }}
                >
                  {`${option} days`}
                </Button>
              ))}
            </ButtonGroup>
          }
        />

        {error ? <Banner tone="critical" title="Couldn't load analytics">{error}</Banner> : null}

        {!hasActivity ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Panel>
              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    No bundle activity yet
                  </Text>
                  <Text as="p" tone="subdued">
                    Your analytics will appear after customers interact with a live BundleKit offer.
                  </Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm" tone="subdued">
                    Setup status
                  </Text>
                  <SetupChecklist
                    items={[
                      { label: "Publish an offer", done: liveCount > 0, onClick: () => navigate("/app/offers") },
                      {
                        label: "Activate automatic discounts",
                        done: functionDeployed,
                        onClick: functionDeployed ? undefined : () => navigate("/app/help"),
                      },
                      { label: "Install BundleKit theme block", done: false, onClick: () => window.open(themeEditor, "_blank") },
                    ]}
                  />
                </BlockStack>
                <InlineStack gap="200">
                  <Button onClick={() => navigate("/app/help")}>Check setup</Button>
                  <Button onClick={() => navigate("/app/offers")}>View offers</Button>
                </InlineStack>
              </BlockStack>
            </Panel>
          </motion.div>
        ) : (
          <>
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
                  trend={card.trend}
                  trendCompareLabel={trendCompareLabel}
                />
              ))}
            </InlineGrid>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
              <Panel>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    From views to revenue
                  </Text>
                  <Funnel stages={funnelStages} />
                </BlockStack>
              </Panel>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
              <Panel>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Revenue and orders over time
                  </Text>
                  <Box background="bg-surface-secondary" borderRadius="200" padding="300">
                    <Chart
                      labels={buckets.map((bucket) => bucket.day)}
                      series={[
                        { label: "Revenue", color: accent, values: buckets.map((bucket) => bucket.revenue) },
                        { label: "Orders", color: "#5C6AC4", values: buckets.map((bucket) => bucket.orders), scale: 100 },
                      ]}
                      formatValue={(value, seriesIndex) => (seriesIndex === 0 ? formatMoney(value, currency) : `${value} orders`)}
                      formatLabel={(label) => new Date(`${label}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    />
                  </Box>
                  <Text as="p" tone="subdued" variant="bodySm">
                    Orders are scaled for visibility on the same axis as revenue.
                  </Text>
                </BlockStack>
              </Panel>
            </motion.div>
          </>
        )}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }}>
          <Panel padding="0px">
            <BlockStack gap="0">
              <Box padding="400" paddingBlockEnd="0">
                <Text as="h2" variant="headingMd">
                  Offer performance
                </Text>
              </Box>
              <IndexTable
                resourceName={{ singular: "offer", plural: "offers" }}
                itemCount={sortedOffers.length}
                selectable={false}
                sortable={[true, true, true, true, true, true]}
                sortDirection={sortDirection}
                sortColumnIndex={sortColumnIndex}
                onSort={handleSort}
                headings={[
                  { title: "Offer" },
                  { title: "Views" },
                  { title: "Selections" },
                  { title: "Orders" },
                  { title: "Conversion" },
                  { title: "Revenue" },
                ]}
                emptyState={
                  <BlockStack gap="200" inlineAlign="center">
                    <Text as="p" tone="subdued">
                      No activity yet. Make sure at least one offer is Live and the BundleKit theme block is installed.
                    </Text>
                  </BlockStack>
                }
              >
                {sortedOffers.map((offer, index) => (
                  <IndexTable.Row id={offer.offerId} key={offer.offerId} position={index}>
                    <IndexTable.Cell>
                      <Link to={`/app/offers/${offer.offerId}`}>{offer.name}</Link>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{offer.views}</IndexTable.Cell>
                    <IndexTable.Cell>{offer.selects}</IndexTable.Cell>
                    <IndexTable.Cell>{offer.orders}</IndexTable.Cell>
                    <IndexTable.Cell>{offer.conversion === null ? "—" : `${offer.conversion.toFixed(1)}%`}</IndexTable.Cell>
                    <IndexTable.Cell>{formatMoney(offer.revenue, currency)}</IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </BlockStack>
          </Panel>
        </motion.div>
      </BlockStack>
    </Page>
  );
}
