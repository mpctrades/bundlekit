import type { ReactNode } from "react";
import { BORDER, BRAND_ACCENT } from "../lib/theme";

export function Panel({
  children,
  padding = "20px",
  highlighted = false,
}: {
  children: ReactNode;
  padding?: string;
  /** Subtle brand-accent border for the one Panel that should stand out
   *  in a comparison (e.g. the merchant's current plan). Use sparingly. */
  highlighted?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: `1px solid ${highlighted ? BRAND_ACCENT : BORDER}`,
        boxShadow: highlighted ? "0 1px 2px rgba(255,90,31,0.08)" : "0 1px 2px rgba(24,20,15,0.04)",
        padding,
      }}
    >
      {children}
    </div>
  );
}
