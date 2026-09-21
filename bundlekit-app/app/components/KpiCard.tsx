import { BlockStack, Icon, InlineStack, Text } from "@shopify/polaris";
import type { IconSource } from "@shopify/polaris";
import { CaretDownIcon, CaretUpIcon } from "@shopify/polaris-icons";
import { motion } from "motion/react";
import { AnimatedNumber } from "./AnimatedNumber";
import { Panel } from "./Panel";

export interface KpiTrend {
  direction: "up" | "down" | "flat";
  percent: number;
}

export interface KpiCardProps {
  label: string;
  value: number;
  format: (value: number) => string;
  icon: IconSource;
  tint: string;
  delay?: number;
  onClick?: () => void;
  /** Omit when there's no prior period to compare against. */
  trend?: KpiTrend | null;
  /** What the trend is relative to, e.g. "vs previous 30 days". */
  trendCompareLabel?: string;
}

function TrendChip({ trend, compareLabel }: { trend: KpiTrend; compareLabel?: string }) {
  // "up"/"down" here mean the number moved up/down, not good/bad — every KPI
  // on this app (revenue, orders, conversion) is better when higher, so up is
  // always success and down is always the one to watch, with a neutral tone
  // for a flat trend rather than a false-positive green or red.
  const tone = trend.direction === "up" ? "success" : trend.direction === "down" ? "critical" : "subdued";
  const color = trend.direction === "up" ? "#008060" : trend.direction === "down" ? "#D82C0D" : "#6E6555";
  return (
    <InlineStack gap="100" blockAlign="center" wrap={false}>
      {trend.direction !== "flat" ? (
        <span style={{ width: 14, height: 14, display: "inline-flex", color }}>
          <Icon source={trend.direction === "up" ? CaretUpIcon : CaretDownIcon} tone="inherit" />
        </span>
      ) : null}
      <Text as="span" variant="bodySm" fontWeight="medium" tone={tone === "subdued" ? "subdued" : undefined}>
        <span style={{ color: tone === "subdued" ? undefined : color }}>
          {trend.direction === "flat" ? "No change" : `${trend.percent.toFixed(0)}%`}
        </span>
      </Text>
      {compareLabel ? (
        <Text as="span" variant="bodySm" tone="subdued">
          {compareLabel}
        </Text>
      ) : null}
    </InlineStack>
  );
}

export function KpiCard({ label, value, format, icon, tint, delay = 0, onClick, trend, trendCompareLabel }: KpiCardProps) {
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
              {trend ? <TrendChip trend={trend} compareLabel={trendCompareLabel} /> : null}
            </BlockStack>
          </InlineStack>
        </Panel>
      </div>
    </motion.div>
  );
}
