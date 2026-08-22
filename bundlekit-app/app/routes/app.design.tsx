import { useState } from "react";
import { Banner, BlockStack, Button, Checkbox, FormLayout, Icon, InlineStack, Page, RangeSlider, Select, Text, TextField } from "@shopify/polaris";
import { StarFilledIcon } from "@shopify/polaris-icons";
import { motion } from "motion/react";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../lib/shop.server";
import { DEFAULT_TIERS, normaliseTiers, priceTier } from "../lib/pricing";
import { OfferPreview, type CardStyle, type SavingsDisplay } from "../components/OfferPreview";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";

const PREVIEW_UNIT_PRICE = 1990; // €19.90, same demo product as the offer builder

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  return {
    defaultAccent: shop.defaultAccent,
    defaultRadius: shop.defaultRadius,
    defaultShowTrustLine: shop.defaultShowTrustLine,
    defaultBadgeText: shop.defaultBadgeText,
    defaultWidgetTitle: shop.defaultWidgetTitle,
    defaultSavingsDisplay: shop.defaultSavingsDisplay as SavingsDisplay,
    defaultCardStyle: shop.defaultCardStyle as CardStyle,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const form = await request.formData();

  const defaultAccent = String(form.get("defaultAccent") || shop.defaultAccent);
  const defaultRadius = Math.min(24, Math.max(0, Number(form.get("defaultRadius") || shop.defaultRadius)));
  const defaultShowTrustLine = form.get("defaultShowTrustLine") === "on";
  const defaultBadgeText = String(form.get("defaultBadgeText") || shop.defaultBadgeText);
  const defaultWidgetTitle = String(form.get("defaultWidgetTitle") || shop.defaultWidgetTitle);
  const defaultSavingsDisplay = String(form.get("defaultSavingsDisplay") || shop.defaultSavingsDisplay);
  const defaultCardStyle = String(form.get("defaultCardStyle") || shop.defaultCardStyle);

  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      defaultAccent,
      defaultRadius,
      defaultShowTrustLine,
      defaultBadgeText,
      defaultWidgetTitle,
      defaultSavingsDisplay,
      defaultCardStyle,
    },
  });

  return { ok: true };
};

export default function Design() {
  const shop = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const busy = navigation.state === "submitting";

  const [defaultAccent, setDefaultAccent] = useState(shop.defaultAccent);
  const [defaultRadius, setDefaultRadius] = useState(shop.defaultRadius);
  const [defaultShowTrustLine, setDefaultShowTrustLine] = useState(shop.defaultShowTrustLine);
  const [defaultBadgeText, setDefaultBadgeText] = useState(shop.defaultBadgeText);
  const [defaultWidgetTitle, setDefaultWidgetTitle] = useState(shop.defaultWidgetTitle);
  const [defaultSavingsDisplay, setDefaultSavingsDisplay] = useState<SavingsDisplay>(shop.defaultSavingsDisplay);
  const [defaultCardStyle, setDefaultCardStyle] = useState<CardStyle>(shop.defaultCardStyle);

  const save = () => {
    const form = new FormData();
    form.set("defaultAccent", defaultAccent);
    form.set("defaultRadius", String(defaultRadius));
    if (defaultShowTrustLine) form.set("defaultShowTrustLine", "on");
    form.set("defaultBadgeText", defaultBadgeText);
    form.set("defaultWidgetTitle", defaultWidgetTitle);
    form.set("defaultSavingsDisplay", defaultSavingsDisplay);
    form.set("defaultCardStyle", defaultCardStyle);
    submit(form, { method: "post" });
  };

  const badgedTier = normaliseTiers(DEFAULT_TIERS).find((tier) => tier.badge) ?? normaliseTiers(DEFAULT_TIERS)[0];
  const ctaPriced = priceTier(PREVIEW_UNIT_PRICE, badgedTier);

  return (
    <Page>
      <BlockStack gap="500">
        <PageHeader
          eyebrow="Design"
          title="Widget design"
          subtitle="BundleKit automatically matches your theme. Fine-tune only what you need."
          action={
            <Button variant="primary" loading={busy} onClick={save}>
              Save changes
            </Button>
          }
        />

        {actionData && "ok" in actionData ? (
          <Banner tone="success" title="Saved">
            <p>New offers will start with these defaults. Existing offers keep what they already have.</p>
          </Banner>
        ) : null}

        <div
          className="bk-design-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "3fr 2fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <style>{"@media (max-width: 900px) { .bk-design-grid { grid-template-columns: 1fr !important; } }"}</style>
          <div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Panel>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Appearance
                  </Text>
                  <FormLayout>
                    <InlineStack gap="200" blockAlign="end" wrap={false}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          minWidth: 44,
                          borderRadius: 10,
                          background: defaultAccent,
                          border: "1px solid rgba(0,0,0,0.1)",
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <TextField label="Accent color" value={defaultAccent} onChange={setDefaultAccent} autoComplete="off" />
                      </div>
                    </InlineStack>

                    <RangeSlider
                      label="Corner radius"
                      value={defaultRadius}
                      onChange={(value) => setDefaultRadius(Array.isArray(value) ? value[0] : value)}
                      min={0}
                      max={24}
                      output
                      prefix={<Text as="span" tone="subdued" variant="bodySm">Square</Text>}
                      suffix={<Text as="span" tone="subdued" variant="bodySm">Round</Text>}
                    />

                    <TextField
                      label="Most popular badge"
                      value={defaultBadgeText}
                      onChange={setDefaultBadgeText}
                      autoComplete="off"
                      helpText="Shown on whichever tier a merchant marks as the badge."
                    />

                    <Checkbox
                      label='Show "discount applied at checkout" trust line'
                      checked={defaultShowTrustLine}
                      onChange={setDefaultShowTrustLine}
                    />

                    <TextField
                      label="Widget title"
                      value={defaultWidgetTitle}
                      onChange={setDefaultWidgetTitle}
                      autoComplete="off"
                      helpText="The heading shoppers see above your tiers, e.g. “Bundle & save.”"
                    />

                    <Select
                      label="Show savings as"
                      options={[
                        { label: "Amount", value: "amount" },
                        { label: "Percentage", value: "percentage" },
                        { label: "Both", value: "both" },
                      ]}
                      value={defaultSavingsDisplay}
                      onChange={(value) => setDefaultSavingsDisplay(value as SavingsDisplay)}
                    />

                    <Select
                      label="Card style"
                      options={[
                        { label: "Outline", value: "outline" },
                        { label: "Soft", value: "soft" },
                      ]}
                      value={defaultCardStyle}
                      onChange={(value) => setDefaultCardStyle(value as CardStyle)}
                    />
                  </FormLayout>
                  <Text as="p" tone="subdued" variant="bodySm">
                    BundleKit inherits the store font, base text color and button shape by default.
                  </Text>
                </BlockStack>
              </Panel>
            </motion.div>
          </div>

          <div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
              <Panel padding="0px">
                <div style={{ padding: "20px 20px 0" }}>
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="050">
                      <Text as="h2" variant="headingMd">
                        Live preview
                      </Text>
                      <Text as="p" tone="subdued" variant="bodySm">
                        Example product page
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </div>
                <div style={{ padding: 20 }}>
                  <div
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 16,
                      padding: 16,
                      background: "#FAF9F6",
                    }}
                  >
                    <div
                      style={{
                        height: 140,
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 14,
                      }}
                    >
                      <Text as="span" tone="subdued" variant="bodySm">
                        PRODUCT
                      </Text>
                    </div>
                    <Text as="span" tone="subdued" variant="bodySm">
                      YOUR BRAND
                    </Text>
                    <div style={{ margin: "2px 0 6px" }}>
                      <Text as="h3" variant="headingSm">
                        Example bundle product
                      </Text>
                    </div>
                    <InlineStack gap="100" blockAlign="center">
                      {[0, 1, 2, 3, 4].map((star) => (
                        <span key={star} style={{ width: 14, height: 14, color: "#FFB800" }}>
                          <Icon source={StarFilledIcon} tone="inherit" />
                        </span>
                      ))}
                      <Text as="span" tone="subdued" variant="bodySm">
                        212 reviews
                      </Text>
                    </InlineStack>
                    <div style={{ margin: "6px 0 14px" }}>
                      <Text as="span" variant="headingMd">
                        {(PREVIEW_UNIT_PRICE / 100).toFixed(2)}
                      </Text>
                    </div>

                    <div
                      style={{
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 14,
                        padding: 14,
                        background: "#fff",
                      }}
                    >
                      <Text as="span" tone="subdued" variant="bodySm">
                        {defaultWidgetTitle.toUpperCase()}
                      </Text>
                      <div style={{ marginTop: 10 }}>
                        <OfferPreview
                          unitPriceCents={PREVIEW_UNIT_PRICE}
                          tiers={DEFAULT_TIERS}
                          accent={defaultAccent}
                          badgeText={defaultBadgeText}
                          savingsDisplay={defaultSavingsDisplay}
                          cardStyle={defaultCardStyle}
                        />
                      </div>
                      {defaultShowTrustLine ? (
                        <div style={{ marginTop: 10 }}>
                          <Text as="p" tone="subdued" variant="bodySm">
                            Discount applied automatically at checkout
                          </Text>
                        </div>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <button
                        type="button"
                        style={{
                          width: "100%",
                          background: "#1a1a1a",
                          color: "#fff",
                          border: "none",
                          borderRadius: 10,
                          padding: "14px 16px",
                          fontSize: 15,
                          fontWeight: 600,
                          cursor: "default",
                        }}
                      >
                        Add {badgedTier.quantity} to cart — {(ctaPriced.total / 100).toFixed(2)}
                      </button>
                    </div>
                  </div>
                </div>
              </Panel>
            </motion.div>
          </div>
        </div>
      </BlockStack>
    </Page>
  );
}
