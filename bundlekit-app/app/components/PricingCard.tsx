import { Badge, BlockStack, Button, InlineStack, Text } from "@shopify/polaris";
import { BRAND_ACCENT } from "../lib/theme";
import { Panel } from "./Panel";

export interface PricingCardProps {
  name: string;
  price: string;
  features: string[];
  isCurrent: boolean;
  /** Subtle orange accent — reserve for exactly one plan, per the brief's
   *  "use orange carefully" rule. Independent of isCurrent: the current
   *  plan and the popular plan aren't always the same one. */
  isPopular?: boolean;
  actionLabel: string;
  actionUrl: string;
}

export function PricingCard({ name, price, features, isCurrent, isPopular = false, actionLabel, actionUrl }: PricingCardProps) {
  return (
    <Panel highlighted={isPopular}>
      <BlockStack gap="300">
        {isPopular ? (
          <Text as="span" variant="bodySm" fontWeight="bold">
            <span style={{ color: BRAND_ACCENT, letterSpacing: "0.06em" }}>MOST POPULAR</span>
          </Text>
        ) : null}
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingMd">
            {name}
          </Text>
          {isCurrent ? <Badge tone="success">Current</Badge> : null}
        </InlineStack>
        <Text as="p" variant="heading2xl">
          {price}
          <Text as="span" tone="subdued" variant="bodySm">
            {" "}
            / month
          </Text>
        </Text>
        <BlockStack gap="150">
          {features.map((feature) => (
            <Text as="p" variant="bodySm" key={feature}>
              · {feature}
            </Text>
          ))}
        </BlockStack>
        {!isCurrent ? (
          // Plain (not primary) — the page's one primary action already
          // lives in the "Current plan" summary panel; per the brief,
          // avoid multiple visually dominant buttons on one screen.
          <Button url={actionUrl} target="_top" fullWidth>
            {actionLabel}
          </Button>
        ) : null}
      </BlockStack>
    </Panel>
  );
}
