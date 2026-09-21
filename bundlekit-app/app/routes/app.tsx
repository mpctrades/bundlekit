import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { Link, Outlet, isRouteErrorResponse, useLoaderData, useRouteError } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { PAGE_BACKGROUND } from "../lib/theme";
import { PolarisRouterLink } from "../components/PolarisRouterLink";
import { ToastProvider } from "../components/ToastProvider";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  // A successful render means we're past whatever the last error was — clear
  // the reload guards so a future (unrelated) transient error gets its own
  // single automatic retry instead of silently no-op'ing.
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem("bk:app-error-response-reload");
  }
  return (
    <AppProvider apiKey={apiKey}>
      {/* Polaris React components (Page, Card, ...) need their own i18n
          provider — the AppProvider above only wires up App Bridge. */}
      <PolarisAppProvider i18n={polarisTranslations} linkComponent={PolarisRouterLink}>
        <NavMenu>
          <Link to="/app" rel="home">Dashboard</Link>
          <Link to="/app/offers">Offers</Link>
          <Link to="/app/design">Design</Link>
          <Link to="/app/analytics">Analytics</Link>
          <Link to="/app/settings">Settings</Link>
          <Link to="/app/billing">Plans &amp; billing</Link>
          <Link to="/app/help">Help &amp; support</Link>
        </NavMenu>
        <div style={{ background: PAGE_BACKGROUND, minHeight: "100vh" }}>
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </div>
      </PolarisAppProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  // boundary.error() assumes a thrown auth response carries an HTML bounce
  // page as `.data` — with `unstable_newEmbeddedAuthStrategy`, a session
  // error during a client-side navigation instead carries a JSON object,
  // which dangerouslySetInnerHTML then coerces to the literal string
  // "[object Object]". Reload in that case so App Bridge's own token
  // exchange (not this boundary) handles reauthentication.
  if (isRouteErrorResponse(error) && typeof error.data !== "string") {
    reloadOnce("bk:app-error-response-reload");
    return null;
  }
  if (isRouteErrorResponse(error)) {
    return boundary.error(error);
  }
  // Anything that isn't a Response the auth layer threw — a Prisma error, a
  // rejected Admin API call, any plain JS exception from a loader/action —
  // falls through boundary.error()'s own `throw error`, which skips this
  // component entirely and lands on React Router's bare, un-embedded
  // "Unexpected Application Error!" page (no <html>/<head>, no way back into
  // the app). That's the literal failure App Review hit on every click: once
  // any route's loader threw for any reason, there was no in-app recovery.
  // Log it, retry the navigation once (covers a transient blip), and only
  // show a real Polaris-shaped error state if the retry lands here again.
  console.error(error);
  return (
    <ErrorFallback
      onRetry={() => {
        // An explicit click, not the automatic reload above — always honor it.
        if (typeof window !== "undefined") window.location.reload();
      }}
    />
  );
}

function reloadOnce(key: string) {
  if (typeof window === "undefined") return;
  // Guard against a genuinely broken route reloading forever.
  if (window.sessionStorage.getItem(key)) return;
  window.sessionStorage.setItem(key, "1");
  window.location.reload();
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ background: PAGE_BACKGROUND, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Something went wrong</p>
        <p style={{ fontSize: 13, color: "#6E6555", marginBottom: 16 }}>
          BundleKit hit an unexpected error loading this page. Try again, or reopen the app from Shopify admin.
        </p>
        <button
          onClick={onRetry}
          style={{ fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: "1px solid #E7E0D0", background: "#fff", cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const headers = boundary.headers;
