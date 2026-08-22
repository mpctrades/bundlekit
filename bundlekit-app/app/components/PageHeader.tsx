import type { ReactNode } from "react";
import { InlineStack, Text } from "@shopify/polaris";
import { motion } from "motion/react";
import { BRAND_ACCENT } from "../lib/theme";
import { Logo } from "./Logo";

export interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <InlineStack align="space-between" blockAlign="start" gap="400" wrap={false}>
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <Logo size={32} />
          <div>
            <div style={{ marginBottom: 2, lineHeight: 1 }}>
              <Text as="span" variant="bodySm" fontWeight="bold">
                <span style={{ color: BRAND_ACCENT, letterSpacing: "0.08em" }}>{eyebrow.toUpperCase()}</span>
              </Text>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, color: "#1a1a1a" }}>
              {title}
            </div>
            {subtitle ? (
              <div style={{ marginTop: 2 }}>
                <Text as="p" tone="subdued" variant="bodyMd">
                  {subtitle}
                </Text>
              </div>
            ) : null}
          </div>
        </InlineStack>
        {action ? <div style={{ paddingTop: 4 }}>{action}</div> : null}
      </InlineStack>
    </motion.div>
  );
}
