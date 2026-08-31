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
    if (typeof window !== "undefined") window.location.reload();
    return null;
  }
  return boundary.error(error);
}

export const headers = boundary.headers;
