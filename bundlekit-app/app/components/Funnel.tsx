import { BlockStack, InlineStack, Text } from "@shopify/polaris";

export interface FunnelStage {
  label: string;
  value: string;
  /** e.g. "21.2% selection rate" — omitted when the previous stage is zero. */
  sublabel?: string;
}

/** Tells the views → selections → orders → revenue story in one glance,
 *  instead of four isolated numbers a merchant has to mentally connect. */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  return (
    <InlineStack gap="0" wrap>
      {stages.map((stage, index) => (
        <div key={stage.label} style={{ display: "flex", alignItems: "center", flex: "1 1 150px", minWidth: 150 }}>
          <BlockStack gap="050">
            <Text as="span" variant="heading2xl" fontWeight="bold">
              {stage.value}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {stage.label}
            </Text>
            {stage.sublabel ? (
              <Text as="span" variant="bodySm" fontWeight="semibold" tone="success">
                {stage.sublabel}
              </Text>
            ) : (
              <div style={{ height: 18 }} />
            )}
          </BlockStack>
          {index < stages.length - 1 ? (
            <div
              aria-hidden="true"
              style={{ color: "rgba(0,0,0,0.2)", fontSize: 22, padding: "0 16px", flexShrink: 0 }}
            >
              →
            </div>
          ) : null}
        </div>
      ))}
    </InlineStack>
  );
}
