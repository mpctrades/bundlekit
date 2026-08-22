import { Link } from "react-router";

/**
 * Wired into PolarisAppProvider's `linkComponent` (see app/routes/app.tsx).
 *
 * Without this, every Polaris prop that takes a `url` (Page's `backAction`,
 * Button's `url`, EmptyState actions, ...) renders a plain `<a href>`. Inside
 * Shopify's embedded admin iframe that's a full top-level page reload, which
 * depends on cookies the iframe can't reliably rely on — the exact way the
 * offer builder's back arrow ended up dumping merchants onto the bare
 * "Log in to BundleKit" shop-domain form instead of going back to Offers.
 * Routing internal `/app/...` urls through React Router's `Link` keeps the
 * navigation client-side and inside the already-authenticated session.
 * External links (theme editor, new tabs) still get a real anchor tag.
 */
export function PolarisRouterLink({
  url,
  external,
  target,
  children,
  ...rest
}: {
  url: string;
  external?: boolean;
  target?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  const isExternal = external || target === "_blank" || /^([a-z][a-z0-9+.-]*:)?\/\//i.test(url) || url.startsWith("mailto:") || url.startsWith("tel:");

  if (isExternal) {
    return (
      <a href={url} target={target} rel={target === "_blank" ? "noopener noreferrer" : undefined} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link to={url} {...rest}>
      {children}
    </Link>
  );
}
