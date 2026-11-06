import { useEffect, useState } from "react";
import { Badge, Banner, BlockStack, Button, Collapsible, Icon, InlineStack, Page, Text } from "@shopify/polaris";
import type { IconSource } from "@shopify/polaris";
import {
  CartDiscountIcon,
  ChevronDownIcon,
  DiscountIcon,
  LockIcon,
  PaintBrushFlatIcon,
  StoreIcon,
} from "@shopify/polaris-icons";
import { motion } from "motion/react";
import { useActionData, useLoaderData, useNavigate, useNavigation, useSubmit } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate, apiVersion } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../lib/shop.server";
import { getFunctionId } from "../lib/offers.server";
import { friendlyErrorMessage } from "../lib/errors";
import { useThemeEditorDeepLink } from "../lib/theme";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/ToastProvider";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Settings edits real per-shop defaults — if the read fails we can't fake
  // plausible values without risking a merchant unknowingly overwriting
  // real settings with fabricated ones, so this returns a distinct shape
  // the page renders as a plain error state instead of a form.
  try {
    const shop = await getOrCreateShop(session.shop);
    // Same health check the Dashboard already runs — here purely to show
    // the "Integration status" panel's Automatic discounts row.
    const functionDeployed = await getFunctionId(admin, shop).then(
      () => true,
      (error) => {
        console.warn("[bundlekit] function lookup failed", error);
        return false;
      },
    );
    // A storefront view beacon only exists once the block is on a product page.
    const widgetSeen = (await prisma.offerStat.count({ where: { offer: { shopId: shop.id }, views: { gt: 0 } } })) > 0;
    return {
      ok: true as const,
      widgetSeen,
      shopDomain: session.shop,
      currency: shop.currency,
      primaryLocale: shop.primaryLocale,
      installedAt: shop.installedAt,
      combineProductDefault: shop.combineProductDefault,
      combineOrderDefault: shop.combineOrderDefault,
      design: {
        accent: shop.defaultAccent,
        radius: shop.defaultRadius,
        title: shop.defaultWidgetTitle,
        badgeText: shop.defaultBadgeText,
        cardStyle: shop.defaultCardStyle,
        savingsDisplay: shop.defaultSavingsDisplay,
        trustLine: shop.defaultShowTrustLine,
      },
      scopes: (session.scope ?? "").split(",").filter(Boolean),
      apiVersion,
      functionDeployed,
    };
  } catch (error) {
    console.error("[bundlekit] settings loader failed", error);
    return { ok: false as const, error: friendlyErrorMessage(error) };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const shop = await getOrCreateShop(session.shop);
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        combineProductDefault: form.get("combineProductDefault") === "on",
        combineOrderDefault: form.get("combineOrderDefault") === "on",
      },
    });
  } catch (error) {
    console.error("[bundlekit] settings save failed", error);
    return { error: "Your settings couldn't be saved. Please try again." };
  }

  return { ok: true };
};


const SAVINGS_LABEL: Record<string, string> = { amount: "Amount saved", percentage: "Percent saved", both: "Amount + percent" };
const CARD_STYLE_LABEL: Record<string, string> = { outline: "Outline", soft: "Soft fill" };

function SectionTitle({ icon, tone, title, subtitle, action }: { icon: IconSource; tone?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <InlineStack align="space-between" blockAlign="start" gap="300" wrap={false}>
      <InlineStack gap="300" blockAlign="center" wrap={false}>
        <span className={`bk-bubble${tone ? ` bk-bubble--${tone}` : ""}`}>
          <Icon source={icon} tone="inherit" />
        </span>
        <div>
          <Text as="h2" variant="headingMd">
            {title}
          </Text>
          {subtitle ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {subtitle}
            </Text>
          ) : null}
        </div>
      </InlineStack>
      {action}
    </InlineStack>
  );
}

function ToggleOption({ checked, onChange, title, description, example }: { checked: boolean; onChange: (value: boolean) => void; title: string; description: string; example: string }) {
  return (
    <div
      className={`bk-option${checked ? " bk-option--on" : ""}`}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {title}
        </Text>
        <Text as="span" variant="bodySm" tone="subdued">
          {description}
        </Text>
        <Text as="span" variant="bodySm">
          <span style={{ color: checked ? "#0c5132" : "#6E6555" }}>{example}</span>
        </Text>
      </div>
      <span className={`bk-switch${checked ? " bk-switch--on" : ""}`} aria-hidden />
    </div>
  );
}

type RowState = "active" | "attention" | "neutral";
const DOT: Record<RowState, string> = { active: "#008060", attention: "#B98900", neutral: "#A39C89" };

function StatusRow({ label, state, text, action }: { label: string; state: RowState; text: string; action?: React.ReactNode }) {
  return (
    <div className="bk-row">
      <span className="bk-row__key">{label}</span>
      <InlineStack gap="200" blockAlign="center" wrap={false}>
        <span style={{ width: 8, height: 8, minWidth: 8, borderRadius: "50%", background: DOT[state] }} />
        <span className="bk-row__value" style={{ color: DOT[state] }}>
          {text}
        </span>
        {action}
      </InlineStack>
    </div>
  );
}

export default function Settings() {
  const data = useLoaderData<typeof loader>();
  const themeEditor = useThemeEditorDeepLink("shopDomain" in data ? String(data.shopDomain) : "");
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const busy = navigation.state === "submitting";
  const { showToast } = useToast();

  const savedProduct = data.ok && data.combineProductDefault;
  const savedOrder = data.ok && data.combineOrderDefault;
  const [combineProductDefault, setCombineProductDefault] = useState(savedProduct);
  const [combineOrderDefault, setCombineOrderDefault] = useState(savedOrder);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const dirty = combineProductDefault !== savedProduct || combineOrderDefault !== savedOrder;

  useEffect(() => {
    if (actionData && "ok" in actionData) showToast("Settings saved");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionData]);

  const save = () => {
    const form = new FormData();
    if (combineProductDefault) form.set("combineProductDefault", "on");
    if (combineOrderDefault) form.set("combineOrderDefault", "on");
    submit(form, { method: "post" });
  };

  if (!data.ok) {
    return (
      <Page>
        <BlockStack gap="500">
          <PageHeader eyebrow="Settings" title="Settings" subtitle="Defaults, shop info, and what BundleKit can access." />
          <Banner tone="critical" title="Couldn't load settings">
            {data.error}
          </Banner>
        </BlockStack>
      </Page>
    );
  }

  const { design } = data;
  const setupDone = [data.functionDeployed, data.widgetSeen, data.scopes.length > 0].filter(Boolean).length;
  const fade = (delay: number) => ({ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.25 } });

  return (
    <Page>
      <BlockStack gap="500">
        <PageHeader
          eyebrow="Settings"
          title="Settings"
          subtitle="Store-wide defaults, your widget at a glance, and what BundleKit can access."
          action={
            <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>
              Save
            </Button>
          }
        />

        {actionData && "error" in actionData ? (
          <Banner tone="critical" title="Not saved">
            <p>{actionData.error}</p>
          </Banner>
        ) : null}

        <div className="bk-settings-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
          <style>{`@media (max-width: 900px) { .bk-settings-grid { grid-template-columns: 1fr !important; } }`}</style>

          <BlockStack gap="400">
            <motion.div {...fade(0)}>
              <Panel>
                <BlockStack gap="400">
                  <SectionTitle
                    icon={CartDiscountIcon}
                    title="Discount stacking"
                    subtitle="Can shoppers use a discount code on top of a BundleKit tier?"
                    action={dirty ? <Badge tone="attention">Unsaved</Badge> : undefined}
                  />
                  <BlockStack gap="200">
                    <ToggleOption
                      checked={combineProductDefault}
                      onChange={setCombineProductDefault}
                      title="Product discount codes"
                      description="Codes that take money off specific products."
                      example={
                        combineProductDefault
                          ? "On: a 10% product code is applied on top of the tier price."
                          : "Off: a product code can’t be combined with the tier discount."
                      }
                    />
                    <ToggleOption
                      checked={combineOrderDefault}
                      onChange={setCombineOrderDefault}
                      title="Order discount codes"
                      description="Codes that take money off the whole order, like WELCOME10."
                      example={
                        combineOrderDefault
                          ? "On: an order code still works after the tier discount."
                          : "Off: an order code can't be used together with a tier discount."
                      }
                    />
                  </BlockStack>
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <span style={{ width: 16, height: 16, minWidth: 16, display: "inline-flex", color: "#6E6555" }}>
                      <Icon source={DiscountIcon} tone="inherit" />
                    </span>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Shipping discounts always combine. These are defaults for new offers — each offer can change them in the offer builder.
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Panel>
            </motion.div>

            <motion.div {...fade(0.05)}>
              <Panel>
                <BlockStack gap="400">
                  <SectionTitle
                    icon={PaintBrushFlatIcon}
                    tone="purple"
                    title="Storefront widget"
                    subtitle="How your offers look on product pages."
                    action={
                      <Button onClick={() => navigate("/app/design")} size="slim">
                        Edit design
                      </Button>
                    }
                  />
                  <div className="bk-grid-2" style={{ gap: 20, alignItems: "center" }}>
                    {/* A tiny static mock of the widget, using the saved design. */}
                    <div
                      aria-hidden
                      style={{ background: "#FAF8F4", border: "1px solid #F1EDE5", borderRadius: 12, padding: 14, display: "grid", gap: 8 }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#18140F" }}>{design.title}</div>
                      {[
                        { qty: "1 unit", save: "", picked: false },
                        { qty: "2 units", save: design.savingsDisplay === "amount" ? "Save €3.98" : design.savingsDisplay === "percentage" ? "Save 10%" : "Save €3.98 (10%)", picked: true },
                      ].map((row) => (
                        <div
                          key={row.qty}
                          style={{
                            position: "relative",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "9px 12px",
                            borderRadius: Math.min(design.radius, 16),
                            border: row.picked ? `2px solid ${design.accent}` : "1px solid #E7E0D0",
                            background: row.picked && design.cardStyle === "soft" ? `${design.accent}14` : "#fff",
                            fontSize: 12,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "#18140F" }}>{row.qty}</span>
                          <span style={{ color: "#008060", fontWeight: 600 }}>{row.save}</span>
                          {row.picked && design.badgeText ? (
                            <span
                              style={{
                                position: "absolute",
                                top: -9,
                                right: 10,
                                background: design.accent,
                                color: "#fff",
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                padding: "2px 7px",
                                borderRadius: 999,
                              }}
                            >
                              {design.badgeText}
                            </span>
                          ) : null}
                        </div>
                      ))}
                      {design.trustLine ? <div style={{ fontSize: 11, color: "#6E6555" }}>✓ Discount applied automatically at checkout</div> : null}
                    </div>
                    <div className="bk-rows">
                      <div className="bk-row">
                        <span className="bk-row__key">Accent colour</span>
                        <InlineStack gap="150" blockAlign="center" wrap={false}>
                          <span style={{ width: 14, height: 14, borderRadius: 4, background: design.accent, border: "1px solid rgba(0,0,0,0.08)" }} />
                          <span className="bk-row__value">{design.accent.toUpperCase()}</span>
                        </InlineStack>
                      </div>
                      <div className="bk-row">
                        <span className="bk-row__key">Badge</span>
                        <span className="bk-row__value">{design.badgeText || "None"}</span>
                      </div>
                      <div className="bk-row">
                        <span className="bk-row__key">Savings shown as</span>
                        <span className="bk-row__value">{SAVINGS_LABEL[design.savingsDisplay] ?? design.savingsDisplay}</span>
                      </div>
                      <div className="bk-row">
                        <span className="bk-row__key">Card style</span>
                        <span className="bk-row__value">
                          {CARD_STYLE_LABEL[design.cardStyle] ?? design.cardStyle} · {design.radius}px corners
                        </span>
                      </div>
                    </div>
                  </div>
                </BlockStack>
              </Panel>
            </motion.div>

            <motion.div {...fade(0.1)}>
              <Panel>
                <BlockStack gap="400">
                  <SectionTitle icon={LockIcon} tone="green" title="Your data & privacy" subtitle="What BundleKit keeps, and what happens if you leave." />
                  <div className="bk-grid-3" style={{ gap: 12 }}>
                    {[
                      { title: "No customer data", text: "Orders are read for line items only — never names, emails or addresses." },
                      { title: "Only what it needs", text: "Your offers, your widget design, and daily view, pick and order counts." },
                      { title: "Clean uninstall", text: "Shopify turns the discounts off and BundleKit deletes your offers and stats." },
                    ].map((item) => (
                      <div key={item.title} style={{ background: "#FAF8F4", borderRadius: 12, padding: 14, display: "grid", gap: 4 }}>
                        <Text as="span" variant="bodySm" fontWeight="semibold">
                          {item.title}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {item.text}
                        </Text>
                      </div>
                    ))}
                  </div>
                  <InlineStack>
                    <Button variant="plain" url="/privacy" target="_blank">
                      Read the privacy policy
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Panel>
            </motion.div>
          </BlockStack>

          <BlockStack gap="400">
            <motion.div {...fade(0.06)}>
              <Panel>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Setup status
                    </Text>
                    <span className={`bk-chip ${setupDone === 3 ? "bk-chip--current" : "bk-chip--warn"}`}>
                      {setupDone === 3 ? "All good" : `${setupDone} of 3`}
                    </span>
                  </InlineStack>
                  <div className="bk-rows">
                    <StatusRow
                      label="Automatic discounts"
                      state={data.functionDeployed ? "active" : "attention"}
                      text={data.functionDeployed ? "Active" : "Needs setup"}
                      action={data.functionDeployed ? undefined : <Button size="micro" onClick={() => navigate("/app/offers")}>Publish offer</Button>}
                    />
                    <StatusRow
                      label="Theme block"
                      state={data.widgetSeen ? "active" : "neutral"}
                      text={data.widgetSeen ? "Showing" : "Not seen yet"}
                      action={data.widgetSeen ? undefined : <Button size="micro" url={themeEditor} target="_blank">Add</Button>}
                    />
                    <StatusRow
                      label="Permissions"
                      state={data.scopes.length > 0 ? "active" : "attention"}
                      text={data.scopes.length > 0 ? "Connected" : "Not connected"}
                    />
                  </div>
                </BlockStack>
              </Panel>
            </motion.div>

            <motion.div {...fade(0.1)}>
              <Panel>
                <BlockStack gap="300">
                  <InlineStack gap="300" blockAlign="center" wrap={false}>
                    <span className="bk-bubble bk-bubble--blue">
                      <Icon source={StoreIcon} tone="inherit" />
                    </span>
                    <Text as="h2" variant="headingMd">
                      Store
                    </Text>
                  </InlineStack>
                  <div className="bk-rows">
                    <div className="bk-row">
                      <span className="bk-row__key">Domain</span>
                      <span className="bk-row__value">{data.shopDomain}</span>
                    </div>
                    <div className="bk-row">
                      <span className="bk-row__key">Currency</span>
                      <span className="bk-row__value">{data.currency}</span>
                    </div>
                    <div className="bk-row">
                      <span className="bk-row__key">Widget languages</span>
                      <span className="bk-row__value">English, French</span>
                    </div>
                    <div className="bk-row">
                      <span className="bk-row__key">Installed</span>
                      <span className="bk-row__value">
                        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(data.installedAt))}
                      </span>
                    </div>
                  </div>
                </BlockStack>
              </Panel>
            </motion.div>

            <motion.div {...fade(0.14)}>
              <Panel padding="0px">
                <div
                  onClick={() => setTechnicalOpen((open) => !open)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setTechnicalOpen((open) => !open);
                  }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", cursor: "pointer" }}
                >
                  <Text as="h2" variant="headingSm" tone="subdued">
                    Technical information
                  </Text>
                  <span style={{ display: "inline-flex", transform: technicalOpen ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}>
                    <Icon source={ChevronDownIcon} tone="subdued" />
                  </span>
                </div>
                <Collapsible id="technical-information" open={technicalOpen}>
                  <div style={{ padding: "0 20px 20px" }}>
                    <BlockStack gap="400">
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm" tone="subdued">
                          Permissions granted
                        </Text>
                        <InlineStack gap="100" wrap>
                          {data.scopes.length > 0 ? (
                            data.scopes.map((scope) => <Badge key={scope}>{scope}</Badge>)
                          ) : (
                            <Text as="p" tone="subdued" variant="bodySm">
                              No scopes on record yet.
                            </Text>
                          )}
                        </InlineStack>
                      </BlockStack>
                      <Text as="p" variant="bodySm">
                        Admin API version: {data.apiVersion}
                      </Text>
                    </BlockStack>
                  </div>
                </Collapsible>
              </Panel>
            </motion.div>
          </BlockStack>
        </div>
      </BlockStack>
    </Page>
  );
}
