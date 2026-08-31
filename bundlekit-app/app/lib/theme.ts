/** BundleKit's own admin-UI brand color — distinct from Shop.defaultAccent,
 *  which is the merchant-customizable color used in the storefront widget
 *  preview. Changing one must never change the other. */
export const BRAND_ACCENT = "#FF4A1C";
export const PAGE_BACKGROUND = "#F2EFEA";

// Must match the `uid` in extensions/bundlekit-widget/shopify.extension.toml
// and the block's filename (extensions/bundlekit-widget/blocks/bundlekit.liquid).
const THEME_APP_EXTENSION_UID = "ae3ad8c5-765f-b3d0-6624-ae07d0c9c38513395a16";
const THEME_APP_BLOCK_HANDLE = "bundlekit";

/** Deep link to the theme editor with the BundleKit app block preselected. */
export function themeEditorDeepLink(shopDomain: string) {
  return `https://${shopDomain}/admin/themes/current/editor?template=product&addAppBlockId=${THEME_APP_EXTENSION_UID}/${THEME_APP_BLOCK_HANDLE}&target=mainSection`;
}
