import { Text } from "@shopify/polaris";
import type { DisplayStatus } from "../lib/offers.server";

// Semantic status colors: green = live/success, blue = scheduled/informational,
// gray = paused/draft (neutral). Kept separate from BRAND_ACCENT — status is
// never a branding surface.
const STYLES: Record<DisplayStatus, { bg: string; fg: string; dot: string; label: string }> = {
  live: { bg: "rgba(0,128,96,0.12)", fg: "#00543D", dot: "#008060", label: "Live" },
  scheduled: { bg: "rgba(0,91,187,0.10)", fg: "#00457A", dot: "#005BBB", label: "Scheduled" },
  paused: { bg: "rgba(110,101,85,0.12)", fg: "#4A4436", dot: "#6E6555", label: "Paused" },
  draft: { bg: "rgba(110,101,85,0.08)", fg: "#6E6555", dot: "#A39C89", label: "Draft" },
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
