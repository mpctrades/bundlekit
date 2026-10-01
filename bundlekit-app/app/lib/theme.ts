import { useRouteLoaderData } from "react-router";

/** BundleKit's own admin-UI brand color — distinct from Shop.defaultAccent,
 *  which is the merchant-customizable color used in the storefront widget
 *  preview. Changing one must never change the other. */
export const BRAND_ACCENT = "#FF5A1F";
export const INK = "#18140F";
export const INK_SOFT = "#6E6555";
export const BORDER = "#E7E0D0";
export const PAGE_BACKGROUND = "#F2EFEA";

/** The widget prints the accent into a storefront `style` attribute, so only
 *  a plain hex colour is ever stored; anything else keeps `fallback`. */
export function normaliseAccent(value: unknown, fallback: string): string {
  const trimmed = String(value ?? "").trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : fallback;
}

// Must match the block's filename (extensions/bundlekit-widget/blocks/bundlekit.liquid).
const THEME_APP_BLOCK_HANDLE = "bundlekit";

/**
 * Deep link to the theme editor with the BundleKit app block preselected.
 * `addAppBlockId` takes `{api_key}/{block handle}` — the app's client_id, not
 * the extension uid (that `{uuid}` form is deprecated and silently opens the
 * editor without adding the block).
 */
export function themeEditorDeepLink(shopDomain: string, apiKey: string) {
  return `https://${shopDomain}/admin/themes/current/editor?template=product&addAppBlockId=${apiKey}/${THEME_APP_BLOCK_HANDLE}&target=mainSection`;
}

/** Same link, with the api key read from the `/app` layout loader. */
export function useThemeEditorDeepLink(shopDomain: string) {
  const data = useRouteLoaderData("routes/app") as { apiKey?: string } | undefined;
  return themeEditorDeepLink(shopDomain, data?.apiKey ?? "");
}
