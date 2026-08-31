import { useState } from "react";
import { BlockStack, Box, Button, Collapsible, Icon, InlineStack, Layout, List, Page, Text } from "@shopify/polaris";
import { ChevronDownIcon, EmailIcon } from "@shopify/polaris-icons";
import { motion } from "motion/react";
import { useLoaderData, useNavigate } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { themeEditorDeepLink } from "../lib/theme";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return { shopDomain: session.shop };
};

interface Topic {
  id: string;
  title: string;
  body: React.ReactNode;
}

function useTopics(themeEditor: string): Topic[] {
  return [
    {
      id: "getting-started",
      title: "Getting started",
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
      title: "How quantity discounts work",
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
      title: "Installing the theme block",
      body: (
        <BlockStack gap="200">
          <Text as="p">
            BundleKit's widget only appears on your storefront once its app block is added to your product
            page template.
          </Text>
          <List type="number">
            <List.Item>Open the theme editor.</List.Item>
            <List.Item>Select a product page template.</List.Item>
            <List.Item>Add the "BundleKit" app block wherever you want the widget to appear, then save.</List.Item>
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
      id: "discount-stacking",
      title: "Discount stacking",
      body: (
        <Text as="p">
          By default, BundleKit's discount does not combine with other product or order discounts you run
          (it does combine with shipping discounts). You can change these defaults, or override them per
          offer, from the offer builder and from Settings.
        </Text>
      ),
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting",
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
              installed — check the BundleKit setup checklist on your dashboard.
            </Text>
          </BlockStack>
        </BlockStack>
      ),
    },
  ];
}

export default function Help() {
  const { shopDomain } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const themeEditor = themeEditorDeepLink(shopDomain);
  const topics = useTopics(themeEditor);
  const [openId, setOpenId] = useState<string | null>(topics[0]?.id ?? null);

  return (
    <Page>
      <BlockStack gap="500">
        <PageHeader eyebrow="Help" title="Help & support" subtitle="Guides for setting up and troubleshooting BundleKit." />

        <Layout>
          <Layout.Section>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Panel padding="0px">
                <BlockStack gap="0">
                  {topics.map((topic, index) => {
                    const isOpen = openId === topic.id;
                    return (
                      <Box
                        key={topic.id}
                        padding="400"
                        borderBlockStartWidth={index === 0 ? undefined : "025"}
                        borderColor="border-secondary"
                      >
                        <BlockStack gap="300">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setOpenId(isOpen ? null : topic.id)}
                            onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setOpenId(isOpen ? null : topic.id)}
                            style={{ cursor: "pointer" }}
                          >
                            <InlineStack align="space-between" blockAlign="center">
                              <Text as="h2" variant="headingSm">
                                {topic.title}
                              </Text>
                              <div style={{ transform: isOpen ? "rotate(180deg)" : undefined, transition: "transform 150ms ease" }}>
                                <Icon source={ChevronDownIcon} tone="subdued" />
                              </div>
                            </InlineStack>
                          </div>
                          <Collapsible id={topic.id} open={isOpen}>
                            {topic.body}
                          </Collapsible>
                        </BlockStack>
                      </Box>
                    );
                  })}
                </BlockStack>
              </Panel>
            </motion.div>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
              <Panel>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Need help?
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    Can't find what you're looking for, or something looks broken? We usually respond within 24
                    hours.
                  </Text>
                  <Button icon={EmailIcon} url="mailto:team@mpctrades.com" target="_blank" fullWidth>
                    Contact support
                  </Button>
                  <Button variant="plain" onClick={() => navigate("/app")}>
                    Back to dashboard
                  </Button>
                </BlockStack>
              </Panel>
            </motion.div>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
