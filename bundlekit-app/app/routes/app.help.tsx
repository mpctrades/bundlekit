import { useMemo, useState } from "react";
import { BlockStack, Box, Button, Icon, InlineStack, List, Page, Text, TextField } from "@shopify/polaris";
import type { IconSource } from "@shopify/polaris";
import {
  CartDiscountIcon,
  ChartVerticalIcon,
  ClipboardIcon,
  CreditCardIcon,
  DeleteIcon,
  DiscountIcon,
  EmailIcon,
  FlagIcon,
  LanguageIcon,
  PaintBrushFlatIcon,
  PlusCircleIcon,
  SearchIcon,
  ThemeTemplateIcon,
  ViewIcon,
  WrenchIcon,
} from "@shopify/polaris-icons";
import { motion } from "motion/react";
import { useLoaderData, useNavigate } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../lib/shop.server";
import { getFunctionId } from "../lib/offers.server";
import { PLANS, TRIAL_DAYS } from "../lib/billing";
import { useThemeEditorDeepLink } from "../lib/theme";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";
import { HelpAccordionItem } from "../components/HelpAccordion";
import { useToast } from "../components/ToastProvider";

const SUPPORT_EMAIL = "team@mpctrades.com";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  // Same three checks as the Dashboard's setup card, so both agree. Help
  // must still open if any of them fails, so each one degrades to "not done".
  try {
    const shop = await getOrCreateShop(session.shop);
    const [offerCount, liveCount, functionDeployed, viewed] = await Promise.all([
      prisma.offer.count({ where: { shopId: shop.id } }),
      prisma.offer.count({ where: { shopId: shop.id, status: "live" } }),
      getFunctionId(admin, shop).then(
        () => true,
        () => false,
      ),
      prisma.offerStat.count({ where: { offer: { shopId: shop.id }, views: { gt: 0 } } }),
    ]);
    return { shopDomain: session.shop, offerCount, liveCount, functionDeployed, widgetSeen: viewed > 0 };
  } catch (error) {
    console.warn("[bundlekit] help loader setup status failed", error);
    return { shopDomain: session.shop, offerCount: 0, liveCount: 0, functionDeployed: false, widgetSeen: false };
  }
};

interface Topic {
  id: string;
  icon: IconSource;
  title: string;
  /** Extra words the search should match besides the title. */
  keywords: string;
  body: React.ReactNode;
}

function useTopics(themeEditor: string): Topic[] {
  return [
    {
      id: "getting-started",
      icon: FlagIcon,
      title: "Getting started",
      keywords: "setup start first offer publish",
      body: (
        <List type="number">
          <List.Item>Create an offer and choose which products or collections it applies to.</List.Item>
          <List.Item>Publish it — this activates the automatic discount for those products.</List.Item>
          <List.Item>Add the BundleKit block to your product page template in the theme editor.</List.Item>
        </List>
      ),
    },
    {
      id: "how-quantity-discounts-work",
      icon: DiscountIcon,
      title: "How quantity discounts work",
      keywords: "tier buy 2 save percent amount function checkout",
      body: (
        <BlockStack gap="200">
          <Text as="p">
            Each offer has one or more tiers — for example, buy 2 and save 10%, buy 3 and save 15%. When a
            shopper reaches a tier's quantity, the discount is applied automatically by BundleKit's Shopify
            Function at checkout. There's no code for you to add and no discount code for the shopper to enter.
          </Text>
          <Text as="p">The widget on your storefront shows shoppers the tiers so they can see the savings before they add to cart.</Text>
        </BlockStack>
      ),
    },
    {
      id: "installing-theme-block",
      icon: ThemeTemplateIcon,
      title: "Installing the theme block",
      keywords: "widget theme editor block product page template",
      body: (
        <BlockStack gap="200">
          <Text as="p">
            BundleKit's widget only appears on your storefront once its app block is added to your product
            page template.
          </Text>
          <List type="number">
            <List.Item>Open the theme editor.</List.Item>
            <List.Item>Select a product page template.</List.Item>
            <List.Item>Add the "BundleKit — Bundle & save" app block wherever you want the widget to appear, then save.</List.Item>
          </List>
          <Box>
            <Button url={themeEditor} target="_blank">
              Open the theme editor
            </Button>
          </Box>
        </BlockStack>
      ),
    },
    {
      id: "test-an-offer",
      icon: ViewIcon,
      title: "Testing an offer",
      keywords: "test check preview cart total works",
      body: (
        <List type="number">
          <List.Item>Publish the offer and open one of its products on your storefront.</List.Item>
          <List.Item>Pick a tier in the BundleKit widget and add it to the cart.</List.Item>
          <List.Item>Check that the cart and checkout total match the price the widget showed.</List.Item>
        </List>
      ),
    },
    {
      id: "discount-stacking",
      icon: CartDiscountIcon,
      title: "Discount stacking",
      keywords: "combine codes stack other discounts shipping",
      body: (
        <Text as="p">
          By default, BundleKit's discount does not combine with other product or order discounts you run
          (it does combine with shipping discounts). You can change these defaults in Settings, or override
          them for one offer in the offer builder.
        </Text>
      ),
    },
    {
      id: "plans-and-limits",
      icon: CreditCardIcon,
      title: "Plans and offer limits",
      keywords: "price billing upgrade downgrade trial limit",
      body: (
        <BlockStack gap="200">
          <Text as="p">
            Plans limit how many offers can be live at the same time: {PLANS.free.offerLimit} on Free,{" "}
            {PLANS.grow.offerLimit} on Grow and unlimited on Pro. Drafts and paused offers never count.
          </Text>
          <Text as="p">
            Paid plans start with a {TRIAL_DAYS}-day free trial and are billed by Shopify. Changing plan never
            deletes your offers.
          </Text>
        </BlockStack>
      ),
    },
    {
      id: "languages",
      icon: LanguageIcon,
      title: "Languages on your storefront",
      keywords: "language french english translate locale",
      body: (
        <Text as="p">
          The storefront widget ships in English and French and follows the language your shopper is browsing
          in. Offer names and the widget title are shown exactly as you type them.
        </Text>
      ),
    },
    {
      id: "troubleshooting",
      icon: WrenchIcon,
      title: "Troubleshooting",
      keywords: "not showing broken error analytics product names",
      body: (
        <BlockStack gap="300">
          <BlockStack gap="100">
            <Text as="h3" variant="headingSm">
              The widget isn't showing on my product page
            </Text>
            <Text as="p" tone="subdued">
              Confirm the offer is Live (not a draft), the product is targeted by that offer, and the theme
              block has been added to your product page template.
            </Text>
          </BlockStack>
          <BlockStack gap="100">
            <Text as="h3" variant="headingSm">
              BundleKit says it "couldn't load product names"
            </Text>
            <Text as="p" tone="subdued">
              Your offer and its targeting are still saved correctly — this only affects whether BundleKit can
              display product names in the admin. Updating the app's permissions from your Shopify admin
              resolves it.
            </Text>
          </BlockStack>
          <BlockStack gap="100">
            <Text as="h3" variant="headingSm">
              My analytics show no activity
            </Text>
            <Text as="p" tone="subdued">
              Analytics only populate once shoppers view a live, correctly targeted offer with the theme block
              installed — check the setup steps at the top of this page.
            </Text>
          </BlockStack>
        </BlockStack>
      ),
    },
    {
      id: "uninstalling",
      icon: DeleteIcon,
      title: "Uninstalling BundleKit",
      keywords: "remove uninstall delete data",
      body: (
        <Text as="p">
          When you uninstall, Shopify turns off BundleKit's discounts and the widget disappears from your theme
          on its own — nothing is left behind in your theme code. Your offers and stats are deleted from
          BundleKit, so reinstalling starts fresh.
        </Text>
      ),
    },
  ];
}

interface Step {
  label: string;
  hint: string;
  done: boolean;
  action?: { label: string; onClick: () => void };
}

function SetupSteps({ steps }: { steps: Step[] }) {
  const doneCount = steps.filter((step) => step.done).length;
  const nextIndex = steps.findIndex((step) => !step.done);
  return (
    <Panel>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Your setup
          </Text>
          <span className={`bk-chip ${doneCount === steps.length ? "bk-chip--current" : "bk-chip--neutral"}`}>
            {doneCount} of {steps.length} done
          </span>
        </InlineStack>
        <div className="bk-meter" aria-hidden>
          <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <div>
          {steps.map((step, index) => (
            <div className="bk-step" key={step.label}>
              <span
                className={`bk-step__dot${step.done ? " bk-step__dot--done" : index === nextIndex ? " bk-step__dot--next" : ""}`}
              >
                {step.done ? "✓" : index + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text as="p" variant="bodyMd" fontWeight="semibold" tone={step.done ? "subdued" : undefined}>
                  {step.label}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {step.hint}
                </Text>
              </div>
              {!step.done && step.action ? (
                <Button size="slim" variant={index === nextIndex ? "primary" : "secondary"} onClick={step.action.onClick}>
                  {step.action.label}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </BlockStack>
    </Panel>
  );
}

function Tile({ icon, tone, title, text, onClick }: { icon: IconSource; tone?: string; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" className="bk-tile" onClick={onClick}>
      <span className={`bk-bubble${tone ? ` bk-bubble--${tone}` : ""}`}>
        <Icon source={icon} tone="inherit" />
      </span>
      <span style={{ display: "grid", gap: 2 }}>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {title}
        </Text>
        <Text as="span" variant="bodySm" tone="subdued">
          {text}
        </Text>
      </span>
    </button>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API is often blocked inside the admin iframe.
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export default function Help() {
  const { shopDomain, offerCount, liveCount, functionDeployed, widgetSeen } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const themeEditor = useThemeEditorDeepLink(shopDomain);
  const topics = useTopics(themeEditor);
  const [openId, setOpenId] = useState<string | null>(topics[0]?.id ?? null);
  const [query, setQuery] = useState("");

  const filteredTopics = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter((topic) => `${topic.title} ${topic.keywords}`.toLowerCase().includes(q));
  }, [topics, query]);

  const openThemeEditor = () => window.open(themeEditor, "_blank");
  const steps: Step[] = [
    {
      label: "Create and publish an offer",
      hint: liveCount > 0 ? `${liveCount} offer${liveCount === 1 ? "" : "s"} live.` : offerCount > 0 ? "You have a draft — publish it to go live." : "Pick products and set your quantity tiers.",
      done: liveCount > 0,
      action: { label: offerCount > 0 ? "View offers" : "Create offer", onClick: () => navigate(offerCount > 0 ? "/app/offers" : "/app/offers/new") },
    },
    {
      label: "Automatic discounts are on",
      hint: functionDeployed ? "Checkout applies your tiers automatically." : "Turns on when you publish your first offer.",
      done: functionDeployed,
    },
    {
      label: "Widget added to your product page",
      hint: widgetSeen ? "Shoppers are seeing your offers." : "Add the BundleKit block in the theme editor, then save.",
      done: widgetSeen,
      action: { label: "Open theme editor", onClick: openThemeEditor },
    },
  ];

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`BundleKit help — ${shopDomain}`)}`;

  return (
    <Page>
      <BlockStack gap="500">
        <PageHeader eyebrow="Help" title="Help & support" subtitle="Set up BundleKit, find answers, or talk to us." />

        <div className="bk-help-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
          <style>{`@media (max-width: 900px) { .bk-help-grid { grid-template-columns: 1fr !important; } }`}</style>

          <BlockStack gap="400">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <SetupSteps steps={steps} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.25 }}>
              <div className="bk-grid-2">
                <Tile icon={PlusCircleIcon} title="Create an offer" text="Quantity tiers in under a minute." onClick={() => navigate("/app/offers/new")} />
                <Tile icon={PaintBrushFlatIcon} tone="purple" title="Style the widget" text="Colours, badge and card style." onClick={() => navigate("/app/design")} />
                <Tile icon={ThemeTemplateIcon} tone="blue" title="Place it in your theme" text="Opens the theme editor in a new tab." onClick={openThemeEditor} />
                <Tile icon={ChartVerticalIcon} tone="green" title="See what's selling" text="Views, picks and bundle revenue." onClick={() => navigate("/app/analytics")} />
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.25 }}>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Guides & answers
                  </Text>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {filteredTopics.length} article{filteredTopics.length === 1 ? "" : "s"}
                  </Text>
                </InlineStack>
                <TextField
                  label="Search help articles"
                  labelHidden
                  placeholder="Search, e.g. “widget not showing” or “trial”"
                  prefix={<Icon source={SearchIcon} tone="subdued" />}
                  value={query}
                  onChange={setQuery}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setQuery("")}
                />
                <Panel padding="0px">
                  {filteredTopics.length > 0 ? (
                    <BlockStack gap="0">
                      {filteredTopics.map((topic, index) => (
                        <HelpAccordionItem
                          key={topic.id}
                          id={topic.id}
                          icon={topic.icon}
                          title={topic.title}
                          isFirst={index === 0}
                          isOpen={openId === topic.id || (query.trim() !== "" && filteredTopics.length === 1)}
                          onToggle={() => setOpenId(openId === topic.id ? null : topic.id)}
                        >
                          {topic.body}
                        </HelpAccordionItem>
                      ))}
                    </BlockStack>
                  ) : (
                    <Box padding="500">
                      <BlockStack gap="200" inlineAlign="center">
                        <Text as="p" tone="subdued" alignment="center">
                          No articles match “{query}”.
                        </Text>
                        <Button variant="plain" url={mailto} target="_blank">
                          Ask us instead
                        </Button>
                      </BlockStack>
                    </Box>
                  )}
                </Panel>
              </BlockStack>
            </motion.div>
          </BlockStack>

          <BlockStack gap="400">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.25 }}>
              <div
                style={{
                  borderRadius: 16,
                  padding: 22,
                  color: "#fff",
                  background: "linear-gradient(140deg, #18140F 0%, #3A2A1C 100%)",
                  boxShadow: "0 8px 24px rgba(24,20,15,0.18)",
                }}
              >
                <BlockStack gap="300">
                  <span className="bk-bubble" style={{ background: "rgba(255,90,31,0.18)" }}>
                    <Icon source={EmailIcon} tone="inherit" />
                  </span>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>Talk to a real person</div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.75)" }}>
                    Stuck on setup or something looks wrong? Email us and we'll help you get your first offer live.
                  </div>
                  <InlineStack gap="200" blockAlign="center">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#36D399" }} />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Replies within 24 hours</span>
                  </InlineStack>
                  <Button url={mailto} target="_blank" fullWidth variant="primary" tone="critical">
                    Email support
                  </Button>
                  <button
                    type="button"
                    onClick={async () => showToast((await copyText(SUPPORT_EMAIL)) ? "Email address copied" : SUPPORT_EMAIL)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.16)",
                      color: "#fff",
                      borderRadius: 8,
                      padding: "7px 12px",
                      cursor: "pointer",
                      font: "inherit",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ width: 16, height: 16, display: "inline-flex" }}>
                      <Icon source={ClipboardIcon} tone="inherit" />
                    </span>
                    {SUPPORT_EMAIL}
                  </button>
                </BlockStack>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.25 }}>
              <Panel>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingSm">
                    Help us help you faster
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Your store address is added to the email for you. It also helps to include:
                  </Text>
                  <List>
                    <List.Item>The offer name, or a link to the product</List.Item>
                    <List.Item>What you expected and what happened</List.Item>
                    <List.Item>A screenshot, if you can</List.Item>
                  </List>
                </BlockStack>
              </Panel>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.25 }}>
              <Panel>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingSm">
                    More
                  </Text>
                  <div className="bk-rows">
                    <div className="bk-row">
                      <span className="bk-row__key">Plans & billing</span>
                      <Button variant="plain" onClick={() => navigate("/app/billing")}>
                        Compare plans
                      </Button>
                    </div>
                    <div className="bk-row">
                      <span className="bk-row__key">Default settings</span>
                      <Button variant="plain" onClick={() => navigate("/app/settings")}>
                        Open Settings
                      </Button>
                    </div>
                    <div className="bk-row">
                      <span className="bk-row__key">Privacy policy</span>
                      <Button variant="plain" url="/privacy" target="_blank">
                        Read it
                      </Button>
                    </div>
                  </div>
                </BlockStack>
              </Panel>
            </motion.div>
          </BlockStack>
        </div>
      </BlockStack>
    </Page>
  );
}
