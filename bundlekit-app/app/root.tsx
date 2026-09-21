import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from "react-router";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Without a root boundary, any error that isn't caught by a nested route's
// own ErrorBoundary (public routes, /auth/*, or app.tsx's own loader) falls
// through to React Router's bare, unstyled "Unexpected Application Error!"
// page — no <html>/<head>, nothing to click, a dead end. That's what App
// Review hit and reported as "every button/link triggers an application
// error." This must render its own full document shell: when the error
// boundary fires, the default App component above never mounts.
export function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>BundleKit</title>
        <Links />
      </head>
      <body>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
          <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Something went wrong</p>
            <p style={{ fontSize: 13, color: "#6E6555" }}>
              Please reopen BundleKit from Shopify admin.
            </p>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
