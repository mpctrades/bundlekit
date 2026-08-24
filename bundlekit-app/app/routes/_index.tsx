import { redirect, type LoaderFunctionArgs } from "react-router";
import { motion } from "motion/react";
import { login } from "../shopify.server";
import { Logo } from "../components/Logo";
import { BRAND_ACCENT, PAGE_BACKGROUND } from "../lib/theme";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
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
        alignItems: "center",
        justifyContent: "center",
        background: PAGE_BACKGROUND,
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        padding: 24,
      }}
    >
      <style>{`
        .bk-shop-input:focus {
          outline: none;
          border-color: ${BRAND_ACCENT};
          box-shadow: 0 0 0 3px rgba(255, 74, 28, 0.14);
        }
        .bk-login-btn {
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .bk-login-btn:hover {
          background: #2b2b2b;
          box-shadow: 0 6px 16px -4px rgba(26, 26, 26, 0.35);
        }
        .bk-login-btn:active {
          transform: translateY(1px);
        }
      `}</style>

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

          <form
            method="post"
            action="/auth/login"
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <label style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1a1a1a",
                  marginBottom: 6,
                }}
              >
                Shop domain
              </span>
              <input
                type="text"
                name="shop"
                placeholder="my-shop.myshopify.com"
                autoComplete="on"
                className="bk-shop-input"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontSize: 15,
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1px solid #DCD8CF",
                  background: "#FAF9F6",
                  color: "#1a1a1a",
                }}
              />
            </label>
            <button
              type="submit"
              className="bk-login-btn"
              style={{
                width: "100%",
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                background: "#1a1a1a",
                border: "none",
                borderRadius: 10,
                padding: "12px 16px",
                cursor: "pointer",
              }}
            >
              Log in
            </button>
          </form>

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
    </div>
  );
}
