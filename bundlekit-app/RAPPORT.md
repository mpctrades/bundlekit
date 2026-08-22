# RAPPORT — how to test what has been built

Written so that Arthur, or anyone else, can verify the app without asking me a
question. One numbered procedure per thing. If a step fails, that is the bug
report: quote the step number.

Test store: `bundlekit-dev.myshopify.com` · Dawn · multi-currency ON.

---

## R0 · The pricing core (no store needed)

1. `npm test`
2. Expect **24 passed**, two files.
3. These tests contain the exact numbers from the brief: €19.90 → 2 units
   €35.82 (save €3.98) → 3 units €50.75 (save €8.95). If these fail, nothing
   else in this document is worth running.

## R1 · SPIKE-01 — the discount is real at checkout

1. `shopify app deploy`, then `shopify app dev`, open the app in the dev store.
2. Create an offer: name "Toner 2/3", target = specific product, one product id,
   tiers 2 → 10% (badge) and 3 → 15%. Press **Publish**.
3. Expect a green "Saved" banner. In Shopify admin → Discounts, expect one
   automatic discount named "BundleKit — Toner 2/3", status Active.
4. Storefront: open that product, add **2** to cart.
5. Cart page: expect a discount line naming the offer, and a total of €35.82.
6. Proceed to checkout. Expect **€35.82** before shipping. Not €39.80.
7. Change the cart quantity to 3. Expect €50.75.
8. Change to 1. Expect €19.90 and **no** discount line.

**This is the test that matters most.** If step 6 shows the undiscounted price,
stop and fix before building anything else.

## R2 · SPIKE-02 — the block renders

1. Online Store → Themes → Customize → Product template.
2. Add block → Apps → "BundleKit — Bundle & save". Drag it directly above
   "Buy buttons". Save.
3. Expect three tier rows, the middle one selected and badged.
4. Open the live product page. Open devtools console: expect **zero** errors.
5. Click the 3-unit tier. Expect: the row highlights, the quantity field shows
   3, and the Add to cart button reads "Add 3 to cart — €50.75".
6. Click Add to cart, then go to checkout. Expect €50.75 (this is R1 again,
   reached the way a customer reaches it).

## R3 · Products without an offer

1. Open any product that no offer targets.
2. Expect **no** BundleKit markup at all in the page source — the block renders
   nothing rather than an empty box.

## R4 · Theme coverage

Repeat R2 steps 3–5 on: Dawn, Refresh, Craft, Sense, Studio.
Expect the widget to inherit each theme's font and to stay inside the column.
Record any theme where the button label does not update — the selector for the
Add to cart button is the usual culprit (`syncForm` in `bundlekit.js`).

## R5 · Variants and currencies

1. On a multi-variant product, switch variant. Expect all tier prices to
   recalculate from the new variant price.
2. Switch the store currency (Markets). Expect prices in the widget to use the
   shop's money format — comma decimals where the locale uses them.
3. Add 2, check out. Expect the checkout discount to match the widget in the
   new currency.

## R6 · Discount stacking

1. Create a 10%-off discount code in Shopify admin.
2. Offer with combining OFF: add 2 units, apply the code. Expect only the
   bundle discount to apply.
3. Edit the offer, tick "Allow product discount codes to stack", republish.
4. Repeat. Expect both to apply, each named in the cart.
5. Record the resulting totals in a small matrix here. This matrix is the W7
   deliverable.

## R7 · Uninstall and reinstall

1. Uninstall the app from the dev store.
2. Expect: the widget disappears from the product page; the automatic discount
   goes inactive; no leftover BundleKit markup anywhere in the theme.
3. Check the database: the `Shop` row and its offers are gone.
4. Reinstall. Expect a clean empty state, no ghost offers.

## R8 · Storefront budget

1. `du -b extensions/bundlekit-widget/assets/*`
2. Expect the total under **30720 bytes**.
3. Lighthouse the product page with and without the block. Expect no change to
   LCP beyond noise.

## R9 · Attribution

1. With an offer live, place a test order of 2 units through checkout.
2. Expect the order's line item to carry the `_bundlekit` property.
3. Expect the offer list in the app to show 1 order and the revenue, same day.

---

## Known gaps at this commit

- Companion bundle (F4) has no admin UI yet; the Function branch and
  `window.BundleKit.addLines` are in place and untested end to end.
- The offer builder takes product IDs as text. Replace with the App Bridge
  resource picker before anyone but us uses it.
- Plan limits are not enforced yet.
