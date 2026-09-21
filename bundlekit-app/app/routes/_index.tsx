import { redirect, type LoaderFunctionArgs } from "react-router";
import { motion } from "motion/react";
import { Logo } from "../components/Logo";
import { BRAND_ACCENT, PAGE_BACKGROUND } from "../lib/theme";
import { PLANS, PLAN_FEATURES, PLAN_PRICE, type PlanKey } from "../lib/billing";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return null;
};

const FEATURES = [
  "Quantity-break tiers",
  "Real Shopify discounts",
  "One-click theme block",
];

export default function Index() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        background: PAGE_BACKGROUND,
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        padding: "48px 24px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{ width: "100%", maxWidth: 420 }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: "44px 40px 36px",
            boxShadow:
              "0 24px 60px -24px rgba(26,26,26,0.18), 0 2px 8px rgba(26,26,26,0.06)",
            border: "1px solid rgba(26,26,26,0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 8px 20px -8px rgba(26,26,26,0.25)",
              }}
            >
              <Logo size={64} />
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <div
              style={{
                color: BRAND_ACCENT,
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: "0.1em",
                marginBottom: 8,
              }}
            >
              SHOPIFY APP
            </div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#1a1a1a",
                margin: "0 0 8px",
              }}
            >
              BundleKit
            </h1>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.5,
                color: "#6b6b6b",
                margin: 0,
              }}
            >
              Product-page bundles and quantity breaks for Shopify.
            </p>
          </div>

          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#4a4a4a",
              textAlign: "center",
              margin: 0,
              padding: "16px 4px",
              background: "#FAF9F6",
              borderRadius: 12,
              border: "1px solid #EFEBE2",
            }}
          >
            Install BundleKit from the Shopify App Store, or open it from
            <strong> Apps → BundleKit</strong> in your Shopify admin.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 30,
              paddingTop: 22,
              borderTop: "1px solid #EFEBE2",
            }}
          >
            {FEATURES.map((feature) => (
              <div
                key={feature}
                style={{
                  flex: 1,
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: "#8a8a8a",
                  fontWeight: 500,
                  textAlign: "center",
                }}
              >
                {feature}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        id="pricing"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
        style={{ width: "100%", maxWidth: 720 }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#1a1a1a",
            textAlign: "center",
            margin: "0 0 20px",
          }}
        >
          Plans &amp; pricing
        </h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "center",
          }}
        >
          {(Object.keys(PLANS) as PlanKey[]).map((key) => (
            <div
              key={key}
              style={{
                flex: "1 1 200px",
                maxWidth: 220,
                background: "#fff",
                borderRadius: 16,
                padding: "24px 20px",
                boxShadow: "0 2px 8px rgba(26,26,26,0.06)",
                border: "1px solid rgba(26,26,26,0.05)",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
                {PLANS[key].name}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: BRAND_ACCENT, marginBottom: 14 }}>
                {PLAN_PRICE[key]}
                <span style={{ fontSize: 12, fontWeight: 500, color: "#8a8a8a" }}> / month</span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {PLAN_FEATURES[key].map((feature) => (
                  <li
                    key={feature}
                    style={{ fontSize: 13, lineHeight: 1.6, color: "#6b6b6b", marginBottom: 4 }}
                  >
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
