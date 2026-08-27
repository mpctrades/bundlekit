import { useMemo, useState } from "react";
import { BlockStack, Box, ButtonGroup, Button, IndexTable, InlineGrid, Page, Text } from "@shopify/polaris";
import type { IndexTableProps } from "@shopify/polaris";
import { CashDollarIcon, CheckCircleIcon, OrderIcon, ViewIcon } from "@shopify/polaris-icons";
import { motion } from "motion/react";
import { Link, useLoaderData, useNavigate, useSearchParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "../lib/shop.server";
import { bucketByDay, fetchStatsForRange, summarizeByOffer, totalStats } from "../lib/stats.server";
import { formatMoney } from "../lib/format";
import { Chart } from "../components/Chart";
import { Funnel, type FunnelStage } from "../components/Funnel";
import { KpiCard } from "../components/KpiCard";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";

const RANGE_OPTIONS = [7, 30, 90];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("days"));
  const days = RANGE_OPTIONS.includes(requested) ? requested : 30;

  const rows = await fetchStatsForRange(shop.id, days);

  return {
    days,
    currency: shop.currency,
    accent: shop.defaultAccent,
    totals: totalStats(rows),
    buckets: bucketByDay(rows, days),
    perOffer: summarizeByOffer(rows),
  };
};

const OFFER_TABLE_COLUMNS = ["name", "views", "selects", "orders", "conversion", "revenue"] as const;
type OfferTableColumn = (typeof OFFER_TABLE_COLUMNS)[number];

export default function Analytics() {
  const { days, currency, accent, totals, buckets, perOffer } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
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

  const cards = [
    { label: `Revenue (${days}d)`, value: totals.revenue, format: (v: number) => formatMoney(v, currency), icon: CashDollarIcon, tint: "#008060" },
    { label: `Orders (${days}d)`, value: totals.orders, format: (v: number) => String(Math.round(v)), icon: OrderIcon, tint: "#5C6AC4" },
    { label: `Widget views (${days}d)`, value: totals.views, format: (v: number) => String(Math.round(v)), icon: ViewIcon, tint: "#006FBB" },
    { label: `Widget selections (${days}d)`, value: totals.selects, format: (v: number) => String(Math.round(v)), icon: CheckCircleIcon, tint: accent },
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
              <Chart
                labels={buckets.map((bucket) => bucket.day)}
                series={[
                  { label: "Revenue", color: accent, values: buckets.map((bucket) => bucket.revenue) },
                  { label: "Orders", color: "#5C6AC4", values: buckets.map((bucket) => bucket.orders), scale: 100 },
                ]}
                formatValue={(value, seriesIndex) => (seriesIndex === 0 ? formatMoney(value, currency) : `${value} orders`)}
                formatLabel={(label) => new Date(`${label}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              />
              <Text as="p" tone="subdued" variant="bodySm">
                Orders are scaled for visibility on the same axis as revenue.
              </Text>
            </BlockStack>
          </Panel>
        </motion.div>

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
                  { title: "Selects" },
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
