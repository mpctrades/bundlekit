import { InlineStack, Text } from "@shopify/polaris";
import { BRAND_ACCENT } from "../lib/theme";

export interface SetupChecklistItem {
  label: string;
  done: boolean;
  /** Omit when there's no direct action for this item yet (e.g. it resolves
   *  automatically once an earlier step completes). */
  onClick?: () => void;
}

// Three visual states: done (✓ green), needs attention (! amber — the
// merchant can act on it right now via onClick), or pending (○ neutral gray
// — no direct action yet). Reused by the Dashboard's own setup card and by
// Analytics' empty state so both surfaces show the same checklist.
export function SetupChecklist({ items }: { items: SetupChecklistItem[] }) {
  return (
    <>
      {items.map((item) => {
        const state = item.done ? "done" : item.onClick ? "attention" : "pending";
        const iconStyles = {
          done: { bg: "rgba(0,128,96,0.12)", fg: "#008060" },
          attention: { bg: "rgba(0,91,187,0.10)", fg: "#005BBB" },
          pending: { bg: "rgba(110,101,85,0.10)", fg: "#6E6555" },
        }[state];
        return (
          <InlineStack
            key={item.label}
            gap="300"
            blockAlign="center"
            wrap={false}
            {...(item.onClick
              ? {
                  onClick: item.onClick,
                  role: "button" as const,
                  tabIndex: 0,
                  style: { cursor: "pointer" },
                }
              : {})}
          >
            <div
              style={{
                width: 24,
                height: 24,
                minWidth: 24,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: iconStyles.bg,
              }}
            >
              {state === "done" ? (
                <span style={{ width: 14, height: 14, display: "inline-flex" }}>
                  <svg viewBox="0 0 20 20" fill="none" style={{ width: "100%", height: "100%" }}>
                    <path d="M4 10l4 4 8-8" stroke={iconStyles.fg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : (
                <Text as="span" variant="bodySm" fontWeight="bold">
                  <span style={{ color: iconStyles.fg }}>{state === "attention" ? "!" : "○"}</span>
                </Text>
              )}
            </div>
            <Text as="span" variant="bodySm" tone={item.done ? undefined : "subdued"}>
              {item.label}
            </Text>
            {item.onClick && state === "attention" ? (
              <span style={{ marginLeft: "auto" }}>
                <Text as="span" variant="bodySm" fontWeight="semibold">
                  <span style={{ color: BRAND_ACCENT }}>Fix it ›</span>
                </Text>
              </span>
            ) : null}
          </InlineStack>
        );
      })}
    </>
  );
}
