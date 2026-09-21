import type { ReactNode } from "react";
import { Box, Collapsible, Icon, InlineStack, Text } from "@shopify/polaris";
import type { IconSource } from "@shopify/polaris";
import { ChevronDownIcon } from "@shopify/polaris-icons";
import { BRAND_ACCENT } from "../lib/theme";

export interface HelpAccordionItemProps {
  id: string;
  icon: IconSource;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  isFirst?: boolean;
  children: ReactNode;
}

export function HelpAccordionItem({ id, icon, title, isOpen, onToggle, isFirst = false, children }: HelpAccordionItemProps) {
  return (
    <Box padding="400" borderBlockStartWidth={isFirst ? undefined : "025"} borderColor="border-secondary">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onToggle()}
        style={{ cursor: "pointer" }}
      >
        <InlineStack align="space-between" blockAlign="center" gap="300" wrap={false}>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <div
              style={{
                width: 32,
                height: 32,
                minWidth: 32,
                borderRadius: 8,
                background: `${BRAND_ACCENT}1f`,
                color: BRAND_ACCENT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>
                <Icon source={icon} tone="inherit" />
              </span>
            </div>
            <Text as="h2" variant="headingSm">
              {title}
            </Text>
          </InlineStack>
          <span style={{ transform: isOpen ? "rotate(180deg)" : undefined, transition: "transform 150ms ease" }}>
            <Icon source={ChevronDownIcon} tone="subdued" />
          </span>
        </InlineStack>
      </div>
      <Collapsible id={id} open={isOpen}>
        <div style={{ marginTop: 12, marginLeft: 44 }}>{children}</div>
      </Collapsible>
    </Box>
  );
}
