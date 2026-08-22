import type { ReactNode } from "react";

export function Panel({ children, padding = "20px" }: { children: ReactNode; padding?: string }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)",
        padding,
      }}
    >
      {children}
    </div>
  );
}
