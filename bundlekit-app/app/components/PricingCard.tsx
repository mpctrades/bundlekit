import { BlockStack, Button, Icon, InlineStack, Text } from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { BORDER, BRAND_ACCENT, INK } from "../lib/theme";

export interface PricingCardProps {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  isCurrent: boolean;
  /** Orange outline + "Most popular" chip — exactly one plan. */
  isPopular?: boolean;
  actionLabel: string;
  actionUrl: string;
  /** The one dark button on the page: the plan we'd suggest next. */
  primary?: boolean;
}

export function PricingCard({
  name,
  price,
  tagline,
  features,
  isCurrent,
  isPopular = false,
  actionLabel,
  actionUrl,
  primary = false,
}: PricingCardProps) {
  const free = price === "$0";
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: isPopular ? `1.5px solid ${BRAND_ACCENT}66` : `1px solid ${BORDER}`,
        boxShadow: isPopular ? "0 6px 20px rgba(255,90,31,0.10)" : "0 1px 2px rgba(24,20,15,0.04)",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <BlockStack gap="100">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingMd">
            {name}
          </Text>
          {isCurrent ? (
            <span className="bk-chip bk-chip--current">Current plan</span>
          ) : isPopular ? (
            <span className="bk-chip bk-chip--popular">Most popular</span>
          ) : null}
        </InlineStack>
        <div style={{ display: "flex", alignItems: "baseline", gap: 2, color: INK }}>
          <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{price}</span>
          {free ? null : (
            <Text as="span" tone="subdued" variant="bodyMd">
              /month
            </Text>
          )}
        </div>
        <Text as="p" tone="subdued" variant="bodyMd">
          {tagline}
        </Text>
      </BlockStack>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, flex: 1, alignContent: "start" }}>
        {features.map((feature) => (
          <li key={feature} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ width: 20, height: 20, minWidth: 20, display: "inline-flex", color: "#6E6555" }}>
              <Icon source={CheckIcon} tone="inherit" />
            </span>
            <Text as="span" variant="bodyMd">
              {feature}
            </Text>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <Button fullWidth disabled>
          Your current plan
        </Button>
      ) : (
        <Button url={actionUrl} target="_top" fullWidth variant={primary ? "primary" : "secondary"}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
