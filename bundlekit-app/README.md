# BundleKit

Product-page bundles and quantity breaks for Shopify. One widget, real
discounts, flat price.

This repo is the MVP skeleton for Project B of the MPC Trades app factory. It
covers F1 (quantity-break widget), F2 (Shopify Functions discount), F3 (theme
app block), F5 (three discount types), F6 (targeting), F8 (EN/FR) and the
plumbing for F9 (analytics). F4 (companion bundle) has its cart and Function
paths built; the admin picker is the first thing to add.

---

## Read this before you run anything

Two things in here need your eyes, not your trust:

1. **API surface.** The manifests pin `2026-07`, which is newer than what this
   code was written against. Shopify renames things between versions —
   especially discount Function targets, which moved once already. Run
   SPIKE‑01 below **before** building on top of `run.js`. If `shopify app
   generate extension` scaffolds a different target name or export than
   `purchase.product-discount.run` / `run`, keep the scaffold's shape and move
   the body of `run.js` into it. The pricing logic is deliberately isolated in
   `pricing.js` so that port is a ten-minute job, not a rewrite.

2. **Polaris.** The brief calls for Polaris Web Components; this admin uses
   Polaris React, which is the better-documented path today. Swapping later
   touches only `app/routes/app*.tsx` — no business logic moves.

Everything else — the pricing core, the metafield contract, the widget, the
webhooks — is finished code with tests.

---

## Setup

```bash
npm install
cp .env.example .env          # DATABASE_URL only; the CLI fills the rest
npx prisma migrate dev --name init
npm test                      # 24 tests. They must pass before you continue.
shopify app config link        # attach to the app in your Partner account
shopify app dev                # installs on bundlekit-dev.myshopify.com
```

Postgres is the default. For a zero-setup local run, change the `provider` in
`prisma/schema.prisma` to `sqlite`, set `DATABASE_URL="file:./dev.sqlite"`, and
change `targetIds String[]` to `targetIds String` (SQLite has no arrays).

## Deploy the extensions

```bash
shopify app deploy
```

Nothing works until this runs: the widget block and the discount Function both
live on Shopify's side, not yours. The admin's **Publish** button will refuse
with a clear error if it cannot find a deployed Function.

---

## The two spikes — do these first

**SPIKE‑01, the Function.** After `shopify app deploy`, open the app, create an
offer targeting one product with a 2 → −10% tier, and hit Publish. Then on the
storefront: add 2 of that product to the cart, open checkout, confirm the total
is 10% off and the discount is named. Write down every click in `RAPPORT.md`.
If this works, 80% of the project's risk is gone.

**SPIKE‑02, the block.** Theme editor → product template → Add block →
BundleKit → drag above Buy buttons → Save. The widget should render the tiers
you just configured, with no console errors, on Dawn.

Do them in this order. The Function is the thing that can't be faked; the block
is the thing that can be styled later.

---

## Architecture in one paragraph

The admin writes the offer as JSON into a **product metafield**
(`bundlekit.offer`) for every targeted product, and writes a copy of the tiers
into the **discount node's metafield**. The Liquid block prints the product
metafield into the page, so the widget renders with zero network calls. At
checkout, the Function reads both metafields and matches them by offer id. Same
bytes on both sides — which is why the price on the page and the price at
checkout cannot drift.

```
admin save
   ├─ resolve target → product ids        (offers.server.ts)
   ├─ metafieldsSet   → bundlekit.offer   → read by Liquid  → widget
   └─ discountAutomaticAppCreate + config → read by Function → checkout
```

### Offer JSON contract

```jsonc
{
  "v": 1,
  "id": "clx…",                   // Offer.id — also the attribution key
  "kind": "quantity",             // "quantity" | "companion"
  "title":  { "en": "Bundle & save", "fr": "Pack & économies" },
  "discountLabel": "BundleKit — Buy more, save more",
  "tiers": [
    { "quantity": 2, "type": "percentage", "value": 10, "badge": true },
    { "quantity": 3, "type": "percentage", "value": 15 }
  ],
  "design": { "accent": "#FF4A1C", "radius": 10, "showTrustLine": true },
  "labels": { "en": { … }, "fr": { … } }
}
```

`type` is `percentage` (value 0–100), `amount` (cents off the tier) or
`fixed_price` (cents total for the tier). **All money is integer cents,
everywhere, in every file.** The moment a float price enters the system you get
the one-cent checkout bug that fills competitors' one-star reviews.

---

## Where things are

| Path | What it is |
|---|---|
| `app/lib/pricing.ts` | The pricing core. Pure, tested, the only place rounding happens. |
| `app/lib/pricing.test.ts` | 17 tests, including the brief's exact numbers. |
| `app/lib/offers.server.ts` | Targeting, metafield writes, discount create/update. |
| `app/routes/app._index.tsx` | Offer list with 30-day stats. |
| `app/routes/app.offers.$id.tsx` | Offer builder with live preview. |
| `app/routes/webhooks.*` | Uninstall, scopes, orders (attribution), GDPR. |
| `extensions/bundlekit-widget/` | The theme app block: Liquid + vanilla JS + CSS. |
| `extensions/bundlekit-discount/` | The Function. `pricing.js` mirrors the app's core. |

## The rules this code holds

- **Storefront budget.** `bundlekit.js` + `.css` must stay under 30 KB
  uncompressed. Check with `du -b extensions/bundlekit-widget/assets/*`. No
  framework, no external font, no render-blocking script.
- **Never break a product page.** Every failure path in the widget hides the
  block instead of throwing. Analytics is fire-and-forget.
- **Never break a checkout.** `run.js` returns an empty result on any bad
  input, including malformed JSON. There is a test for this.
- **EN + FR from line one**, admin and storefront. Locale files are in
  `extensions/bundlekit-widget/locales/`.
- **Real discounts only.** No duplicate variants, no draft orders, no price
  edits on products. If a feature needs one of those, it is the wrong feature.

## Still to build

- F4 companion bundle: admin product picker + the storefront checkbox UI. The
  cart path (`window.BundleKit.addLines`) and the Function branch already exist.
- App Bridge resource picker to replace the product-ID text field in the offer
  builder.
- Onboarding wizard (W6), analytics dashboard card (W6).

## Plans & billing

Managed Pricing (Free / Grow / Pro, gated on offer count) is built —
`app/routes/app.billing.tsx`, `app/lib/billing.server.ts`. Two things still
need doing outside this repo before it's live:

1. Create the "Grow" and "Pro" plans in the Partner Dashboard (App setup >
   Pricing), with names matching `app/lib/billing.server.ts`'s `PLANS`
   exactly — that name is the only link between a Shopify `AppSubscription`
   and a plan tier.
2. Set `SHOPIFY_APP_HANDLE` (see `.env.example`) to the app's handle as
   shown in the Partner Dashboard — it's part of the Shopify-hosted
   plan-selection URL and isn't the same as the app name.

Plan is read live from `currentAppInstallation.activeSubscriptions` on every
billing-page load and offer-creation attempt — there's no webhook for
Managed Pricing plan changes, so this is intentionally not cached.
