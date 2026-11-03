import { useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

const ASKED_KEY = "bundlekit:review-requested";

/**
 * Asks Shopify to show its native App Store review modal once `ready` is true
 * (a success moment, never a click — Shopify's rate limits would make a
 * button look broken). Shopify decides whether it actually appears:
 * already-reviewed, cooldown, annual limit and recently-installed shops are
 * declined on its side. We only make sure it's asked once per admin session,
 * after the page has settled.
 */
export function useReviewRequest(ready: boolean) {
  const shopify = useAppBridge();

  useEffect(() => {
    if (!ready) return;
    try {
      if (sessionStorage.getItem(ASKED_KEY)) return;
    } catch {
      // Storage blocked: still fine to ask, Shopify rate-limits for us.
    }

    const timer = setTimeout(async () => {
      try {
        sessionStorage.setItem(ASKED_KEY, "1");
      } catch {
        // See above.
      }
      try {
        const result = await shopify.reviews.request();
        if (!result.success) console.info("[bundlekit] review modal not shown:", result.code);
      } catch (error) {
        console.warn("[bundlekit] review request failed", error);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [ready, shopify]);
}
