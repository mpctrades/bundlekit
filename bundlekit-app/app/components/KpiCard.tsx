import { BlockStack, Icon, InlineStack, Text } from "@shopify/polaris";
import type { IconSource } from "@shopify/polaris";
import { motion } from "motion/react";
import { AnimatedNumber } from "./AnimatedNumber";
import { Panel } from "./Panel";

export interface KpiCardProps {
  label: string;
  value: number;
  format: (value: number) => string;
  icon: IconSource;
  tint: string;
  delay?: number;
  onClick?: () => void;
}

export function KpiCard({ label, value, format, icon, tint, delay = 0, onClick }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={onClick ? { y: -3 } : { y: -2 }}
    >
      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? (event) => (event.key === "Enter" || event.key === " ") && onClick() : undefined}
        style={{ cursor: onClick ? "pointer" : "default" }}
      >
        <Panel>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <div
              style={{
                width: 40,
                height: 40,
                minWidth: 40,
                borderRadius: 12,
                background: `${tint}1f`,
                color: tint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon source={icon} tone="inherit" />
            </div>
            <BlockStack gap="050">
              <Text as="h3" tone="subdued" variant="bodySm">
                {label}
              </Text>
              <Text as="p" variant="headingLg">
                <AnimatedNumber value={value} format={format} />
              </Text>
            </BlockStack>
          </InlineStack>
        </Panel>
      </div>
    </motion.div>
  );
}
