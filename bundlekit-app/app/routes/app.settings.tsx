import { useState } from "react";
import { Badge, Banner, BlockStack, Button, Checkbox, Collapsible, Icon, InlineStack, Layout, Page, Text } from "@shopify/polaris";
import { ChevronDownIcon } from "@shopify/polaris-icons";
import { motion } from "motion/react";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate, apiVersion } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../lib/shop.server";
import { Panel } from "../components/Panel";
import { PageHeader } from "../components/PageHeader";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  return {
    shopDomain: session.shop,
    currency: shop.currency,
    primaryLocale: shop.primaryLocale,
    installedAt: shop.installedAt,
    combineProductDefault: shop.combineProductDefault,
    combineOrderDefault: shop.combineOrderDefault,
    scopes: (session.scope ?? "").split(",").filter(Boolean),
    apiVersion,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const form = await request.formData();

  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      combineProductDefault: form.get("combineProductDefault") === "on",
      combineOrderDefault: form.get("combineOrderDefault") === "on",
    },
  });

  return { ok: true };
};

export default function Settings() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const busy = navigation.state === "submitting";

  const [combineProductDefault, setCombineProductDefault] = useState(data.combineProductDefault);
  const [combineOrderDefault, setCombineOrderDefault] = useState(data.combineOrderDefault);
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const save = () => {
    const form = new FormData();
    if (combineProductDefault) form.set("combineProductDefault", "on");
    if (combineOrderDefault) form.set("combineOrderDefault", "on");
    submit(form, { method: "post" });
  };

  return (
    <Page>
      <BlockStack gap="500">
        <PageHeader
          eyebrow="Settings"
          title="Settings"
          subtitle="Defaults, shop info, and what BundleKit can access."
          action={
            <Button variant="primary" loading={busy} onClick={save}>
              Save
            </Button>
          }
        />

        {actionData && "ok" in actionData ? <Banner tone="success" title="Saved" /> : null}

        <Layout>
          <Layout.Section>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Panel>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Combining discounts
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    Applies to new offers only — existing offers keep whatever
                    they were saved with in the offer builder.
                  </Text>
                  <Checkbox
                    label="Allow product discount codes to stack on top by default"
                    checked={combineProductDefault}
                    onChange={setCombineProductDefault}
                  />
                  <Checkbox
                    label="Allow order discount codes to stack on top by default"
                    checked={combineOrderDefault}
                    onChange={setCombineOrderDefault}
                  />
                </BlockStack>
              </Panel>
            </motion.div>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
                <Panel>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Shop
                    </Text>
                    <Text as="p" variant="bodySm">
                      Domain: {data.shopDomain}
                    </Text>
                    <Text as="p" variant="bodySm">
                      Currency: {data.currency}
                    </Text>
                    <Text as="p" variant="bodySm">
                      Primary locale: {data.primaryLocale}
                    </Text>
                    <Text as="p" variant="bodySm">
                      Installed: {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(data.installedAt))}
                    </Text>
                  </BlockStack>
                </Panel>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
                <Panel padding="0px">
                  <div
                    onClick={() => setTechnicalOpen((open) => !open)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setTechnicalOpen((open) => !open);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 20px",
                      cursor: "pointer",
                    }}
                  >
                    <Text as="h2" variant="headingMd" tone="subdued">
                      Technical information
                    </Text>
                    <span
                      style={{
                        display: "inline-flex",
                        transform: technicalOpen ? "rotate(180deg)" : "none",
                        transition: "transform 150ms ease",
                      }}
                    >
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
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingSm" tone="subdued">
                            App
                          </Text>
                          <Text as="p" variant="bodySm">
                            Admin API version: {data.apiVersion}
                          </Text>
                        </BlockStack>
                      </BlockStack>
                    </div>
                  </Collapsible>
                </Panel>
              </motion.div>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
