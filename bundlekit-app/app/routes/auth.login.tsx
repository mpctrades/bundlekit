import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  AppProvider as PolarisAppProvider,
  BlockStack,
  Button,
  Card,
  Page,
  Text,
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { login } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

/**
 * App Store requirement 2.3.1: the app must never ask a merchant to type
 * their myshopify.com domain. Installs and logins always start from a
 * Shopify-owned surface (App Store listing, Shopify admin), which pass
 * `?shop=` for us — so the only thing this route does with a shop is hand it
 * straight to OAuth. Without one, it points the merchant back to Shopify.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    const errors = await login(request);
    // login() throws its redirect on success; reaching here means the shop
    // param was invalid — fall through to the same "open from Shopify" page.
    if (!errors || Object.keys(errors).length === 0) throw redirect("/app");
  }
  return null;
};

export default function AuthLogin() {
  return (
    <PolarisAppProvider i18n={polarisTranslations}>
      <Page narrowWidth>
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">
              Open BundleKit from your Shopify admin
            </Text>
            <Text as="p" tone="subdued">
              BundleKit runs inside Shopify. Open it from Apps → BundleKit in your
              Shopify admin, or install it from the Shopify App Store.
            </Text>
            <div>
              <Button url="https://admin.shopify.com" target="_top" variant="primary">
                Go to Shopify admin
              </Button>
            </div>
          </BlockStack>
        </Card>
      </Page>
    </PolarisAppProvider>
  );
}
