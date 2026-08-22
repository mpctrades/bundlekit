import { Text } from "@shopify/polaris";
import type { DisplayStatus } from "../lib/offers.server";

const STYLES: Record<DisplayStatus, { bg: string; fg: string; dot: string; label: string }> = {
  live: { bg: "rgba(0,128,96,0.12)", fg: "#00543D", dot: "#008060", label: "Live" },
  scheduled: { bg: "rgba(180,120,0,0.12)", fg: "#7A4F00", dot: "#B47800", label: "Scheduled" },
  paused: { bg: "rgba(26,26,26,0.08)", fg: "#1A1A1A", dot: "#1A1A1A", label: "Paused" },
  draft: { bg: "rgba(0,0,0,0.06)", fg: "rgba(0,0,0,0.6)", dot: "rgba(0,0,0,0.35)", label: "Draft" },
};

/** Status is never conveyed by color alone — the dot is decorative, the
 *  label text is what actually distinguishes each state. */
export function StatusPill({ status }: { status: DisplayStatus }) {
  const style = STYLES[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: style.bg,
        color: style.fg,
        borderRadius: 999,
        padding: "3px 10px 3px 8px",
        lineHeight: 1.4,
      }}
    >
      <span style={{ width: 6, height: 6, minWidth: 6, borderRadius: "50%", background: style.dot }} />
      <Text as="span" variant="bodySm" fontWeight="semibold">
        {style.label}
      </Text>
    </span>
  );
}
