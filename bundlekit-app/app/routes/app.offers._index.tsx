import { useMemo, useState } from "react";
import { BlockStack, Box, Button, EmptyState, Icon, InlineStack, Page, Select, Text, TextField } from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { useLoaderData, useNavigate } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  computeDisplayStatus,
  deleteOffer,
  duplicateOffer,
  pauseOffer,
  resumeOffer,
  type DisplayStatus,
  type OfferConfig,
} from "../lib/offers.server";
import { getOrCreateShop } from "../lib/shop.server";
import { formatMoney } from "../lib/format";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/StatusPill";
import { OfferActionsMenu } from "../components/OfferActionsMenu";
import { BRAND_ACCENT } from "../lib/theme";

function summarizeDiscount(config: OfferConfig): string {
  if (config.kind === "companion" && config.companionDiscount) {
    return `−${config.companionDiscount.value}%`;
  }
  return (config.tiers ?? [])
    .map((tier) => {
      if (tier.type === "percentage") return `${tier.quantity} = −${tier.value}%`;
      if (tier.type === "amount") return `${tier.quantity} = −${(tier.value / 100).toFixed(2)}`;
      return `${tier.quantity} = fixed ${(tier.value / 100).toFixed(2)}`;
    })
    .join(" · ") || "—";
}

function summarizeTarget(targetType: string, targetIds: string[]): string {
  if (targetType === "all") return "All products";
  if (targetType === "collection") return `Collection · ${targetIds.length}`;
  return targetIds.length === 1 ? "1 specific product" : `${targetIds.length} specific products`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.upsert({
    where: { domain: session.shop },
    create: { domain: session.shop },
    update: {},
    include: {
      offers: {
        orderBy: { updatedAt: "desc" },
        include: { stats: { orderBy: { day: "desc" }, take: 30 } },
      },
    },
  });

  const now = new Date();

  return {
    shopDomain: session.shop,
    currency: shop.currency,
    offers: shop.offers.map((offer) => {
      const config = offer.config as unknown as OfferConfig;
      return {
        id: offer.id,
        name: offer.name,
        kind: offer.kind,
        status: computeDisplayStatus(offer, now),
        productCount: offer.productCount,
        target: summarizeTarget(offer.targetType, offer.targetIds),
        discount: summarizeDiscount(config),
        views: offer.stats.reduce((sum, stat) => sum + stat.views, 0),
        orders: offer.stats.reduce((sum, stat) => sum + stat.orders, 0),
        revenue: offer.stats.reduce((sum, stat) => sum + Number(stat.revenue), 0),
      };
    }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const offerId = String(form.get("offerId") || "");

  if (!offerId) return { error: "Missing offer." };

  try {
    if (intent === "duplicate") await duplicateOffer(offerId, shop.id);
    else if (intent === "pause") await pauseOffer(admin, offerId);
    else if (intent === "resume") await resumeOffer(admin, offerId);
    else if (intent === "delete") await deleteOffer(admin, offerId, shop.id);
    else return { error: `Unknown action "${intent}".` };
  } catch (error) {
    return { error: (error as Error).message };
  }

  return { ok: true };
};

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "All statuses", value: "all" },
  { label: "Live", value: "live" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Paused", value: "paused" },
  { label: "Draft", value: "draft" },
];

export default function OffersIndex() {
  const { offers, shopDomain, currency } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const themeEditor = `https://${shopDomain}/admin/themes/current/editor?template=product&addAppBlockId=BUNDLEKIT_BLOCK_ID/bundlekit&target=mainSection`;

  const filtered = useMemo(
    () =>
      offers.filter((offer) => {
        if (status !== "all" && offer.status !== status) return false;
        if (search && !offer.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [offers, search, status],
  );

  return (
    <Page>
      <BlockStack gap="500">
        <PageHeader
          eyebrow="Offers"
          title="Offers"
          subtitle="Create and manage your product-page bundle offers."
          action={
            <Button variant="primary" onClick={() => navigate("/app/offers/new")}>
              Create offer
            </Button>
          }
        />

        <Panel padding="0px">
          {offers.length === 0 ? (
            <EmptyState
              heading="Create your first offer"
              action={{ content: "Create offer", onAction: () => navigate("/app/offers/new") }}
              secondaryAction={{ content: "Place the block in your theme", url: themeEditor, target: "_blank" }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Pick what the offer applies to, set your tiers, and publish. Two minutes. Nothing is written into your theme.</p>
            </EmptyState>
          ) : (
            <BlockStack gap="0">
              <div style={{ padding: "16px 20px", display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Search offers"
                    labelHidden
                    placeholder="Search offers"
                    value={search}
                    onChange={setSearch}
                    prefix={<Icon source={SearchIcon} tone="subdued" />}
                    autoComplete="off"
                  />
                </div>
                <div style={{ minWidth: 180 }}>
                  <Select
                    label="Status"
                    labelHidden
                    value={status}
                    onChange={setStatus}
                    options={STATUS_FILTER_OPTIONS}
                  />
                </div>
              </div>

              <style>{`
                .bk-offer-row { cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.06); }
                .bk-offer-row:hover { background: rgba(0,0,0,0.02); }
                .bk-offer-name:hover { text-decoration: underline; }
              `}</style>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                  <thead>
                    <tr style={{ background: "#FAF9F6" }}>
                      {["Offer", "Target", "Discount", "Performance", "Status", ""].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            textAlign: "left",
                            padding: "10px 20px",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            color: "rgba(0,0,0,0.55)",
                            textTransform: "uppercase",
                            borderBottom: "1px solid rgba(0,0,0,0.06)",
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((offer) => (
                      <tr
                        key={offer.id}
                        className="bk-offer-row"
                        onClick={() => navigate(`/app/offers/${offer.id}`)}
                      >
                        <td style={{ padding: "16px 20px" }}>
                          <span className="bk-offer-name" style={{ color: BRAND_ACCENT }}>
                            <Text as="span" variant="bodyMd" fontWeight="semibold" tone="inherit">
                              {offer.name}
                            </Text>
                          </span>
                          <div>
                            <Text as="span" tone="subdued" variant="bodySm">
                              {offer.kind === "quantity" ? "Quantity breaks" : "Companion bundle"}
                            </Text>
                          </div>
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <Text as="span" variant="bodyMd">
                            {offer.target}
                          </Text>
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <Text as="span" variant="bodyMd">
                            {offer.discount}
                          </Text>
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          {offer.status === "live" || offer.status === "paused" ? (
                            <>
                              <Text as="span" variant="bodyMd" fontWeight="semibold">
                                {formatMoney(offer.revenue, currency)}
                              </Text>
                              <div>
                                <Text as="span" tone="subdued" variant="bodySm">
                                  {offer.orders} orders
                                </Text>
                              </div>
                            </>
                          ) : (
                            <Text as="span" tone="subdued" variant="bodyMd">
                              {offer.status === "scheduled" ? "— Starts on schedule" : "— Not published"}
                            </Text>
                          )}
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <StatusPill status={offer.status as DisplayStatus} />
                        </td>
                        <td style={{ padding: "16px 20px", textAlign: "right" }}>
                          <OfferActionsMenu
                            offerId={offer.id}
                            offerName={offer.name}
                            status={offer.status as DisplayStatus}
                            onEdit={() => navigate(`/app/offers/${offer.id}`)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filtered.length === 0 ? (
                <Box padding="800">
                  <BlockStack inlineAlign="center">
                    <Text as="p" tone="subdued">
                      No offers match your search.
                    </Text>
                  </BlockStack>
                </Box>
              ) : null}
            </BlockStack>
          )}
        </Panel>

        <InlineStack align="end">
          <Button url={themeEditor} target="_blank">
            Place BundleKit in theme
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
