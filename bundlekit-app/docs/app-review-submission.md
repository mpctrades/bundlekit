# App Store review — submission pack

Everything the Shopify reviewer needs to test MPC BundleKit without friction.
Paste section 2 into **Partner Dashboard → Apps → MPC BundleKit → Distribution
→ App Store listing → Testing instructions**. Record the video in section 3
and paste its link in the **Demo screencast** field.

---

## 1. Before you press Submit

These have to happen in dashboards and stores, so they're outside this repo:

- [ ] **Protected customer data (level 0).** Partner Dashboard → App → API
      access → Protected customer data → request access to *order data only*
      (no name/email/phone/address fields). Reason: "App functionality —
      attribute bundle revenue per offer in the app's Analytics page."
      `shopify app deploy` rejects the `orders/create` subscription until
      this is granted.
- [ ] **Deploy the new config and extensions:**
      `shopify app deploy --config shopify.app.public.toml`
      (adds `write_app_proxy`, the `/apps/bundlekit` app proxy, and
      `orders/create`). Then deploy the app server (`git pull && npm ci &&
      npm run build && npm run setup && pm2 restart bundlekit`) and add
      `write_app_proxy` to `SCOPES` in the server's `.env`.
- [ ] **Managed Pricing plans** in Partner Dashboard → App → Pricing:
      `Free` ($0), `Grow` ($4.99/mo, 14-day trial), `Pro` ($9.99/mo,
      14-day trial). Names must match `app/lib/billing.ts` exactly. Configure
      a **Free** plan there too, or merchants can't downgrade without
      uninstalling (requirement 1.2.3). Set the welcome link to `/app`.
- [ ] **Demo store** ready as described in section 2 (the reviewer installs
      on their own store, but a store they can browse helps).
- [ ] **Listing assets:** 1200×1200 icon (no text), 3–6 screenshots at
      1600×900 (no browser chrome, no pricing, no fabricated numbers), demo
      video.
- [ ] **Emergency contact + support email** (`team@mpctrades.com`) and
      privacy policy URL (`https://bundlekit.mpctrades.com/privacy.html`)
      filled in on the listing.

---

## 2. Testing instructions (paste into the listing form)

> **Credentials:** None needed. MPC BundleKit is an embedded app that uses
> Shopify session tokens only. There is no separate account, login, or API
> key. Install it on any development store and it opens straight into the
> app.
>
> **Requirements on the test store:** an Online Store 2.0 theme (Dawn is
> fine) and at least one product with a price.
>
> **1. Install.** Approve the permissions. You land on the BundleKit
> Dashboard, which shows a setup checklist.
>
> **2. Create an offer.** Offers → Create offer. Keep the default tiers
> (2 units −10%, 3 units −15%). Under *Applies to*, choose **Specific
> products** and pick one product with the product picker. Click
> **Publish**. A "Saved" toast appears, and Shopify admin → Discounts now
> lists an active automatic discount named "BundleKit — …".
>
> **3. Add the widget to the theme.** On the offer page, click **Open the
> theme editor**. The editor opens on the product template with the
> "BundleKit — Bundle & save" app block already added. Click **Save**. (No
> theme code is edited. The widget is a theme app extension block.)
>
> **4. Storefront.** Open the product you targeted. The widget shows the tiers
> above Add to cart. Choose "3 units". The quantity and button label update.
> Add to cart and go to checkout. The checkout total is 15% off, and the
> discount is named. With 1 unit there's no discount. Products that no offer
> targets show no widget at all.
>
> **5. Analytics.** Analytics shows widget views and tier selections. After a
> test order (Bogus Gateway), it also shows the order count and discounted
> revenue for that offer.
>
> **6. Billing.** Plans & billing → *Choose a plan* opens Shopify's
> plan-selection page (Managed Pricing). Grow and Pro have a 14-day trial.
> You can upgrade, downgrade, or return to Free there, without contacting us.
> The Free plan allows 3 live offers (drafts are unlimited). Publishing a 4th shows an upgrade prompt.
>
> **7. Uninstall.** Uninstalling removes the widget and deactivates the
> automatic discount (Shopify does both). Our webhook deletes the shop's
> offers and stats. Reinstalling starts clean, with no ghost offers.
>
> **Data:** BundleKit stores no customer personal data. The orders/create
> webhook is limited to `id` and `line_items` (include_fields). It's used
> only to total revenue for lines that carry our `_bundlekit` line property.
>
> Contact during review: team@mpctrades.com

---

## 3. Demo video: 2–3 minute script

Record in a dev store at 1080p, with no browser address bar visible and no
real customer data. Narrate or caption each step. Keep it in English, or
add English subtitles.

| # | Time | Show |
|---|------|------|
| 1 | 0:00–0:15 | App listing → Install → permission screen → lands on Dashboard. |
| 2 | 0:15–0:55 | Offers → Create offer: tiers, discount type, product picker, Publish. Cut to Shopify admin → Discounts showing the active automatic discount. |
| 3 | 0:55–1:20 | "Open the theme editor" deep link → block pre-added → Save. |
| 4 | 1:20–2:00 | Storefront product page: widget, select 3 units, Add to cart, checkout total shows the named discount. Show 1 unit = no discount. |
| 5 | 2:00–2:20 | Design page (colours/radius) and Settings (discount stacking). |
| 6 | 2:20–2:40 | Analytics after the test order. Plans & billing → Shopify plan page. |
| 7 | 2:40–2:50 | Help & support page and support email. |

---

## 4. What the self-review fixed (2026-09-28)

- `/auth/login` no longer asks for a myshopify.com domain (requirement 2.3.1).
  It forwards `?shop=` to OAuth or points the merchant to Shopify admin.
- The theme-editor deep link now uses `{api_key}/{handle}` instead of the
  deprecated extension-uid form, which opened the editor without adding the
  block (requirement 5.1.3).
- Storefront analytics beacons now reach the app. The `/apps/bundlekit` app
  proxy they post to was never configured, so every view and selection was
  lost.
- `orders/create` is re-enabled (with `include_fields`), so orders and
  revenue attribution actually populate. Revenue is now net of discounts.
- The widget's JS and CSS loaded twice, so the widget mounted twice and sent
  duplicate view beacons.
- The uninstall webhook cleans up the shop even when Shopify retries it
  after the session is gone.
- `orders/create` deliveries are de-duplicated by webhook id
  (`ProcessedWebhook` table, migration `20260928000000`), so Shopify's
  retries can't double-count revenue. `npm run setup` applies it.
- The website's unverified annual-billing claim is gone.
- Plan copy (app and website) now matches what the code enforces. The
  unbuilt "Powered by BundleKit" badge and the plan-gated features that
  weren't actually gated are gone.
