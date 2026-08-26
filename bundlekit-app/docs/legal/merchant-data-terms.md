# BundleKit Merchant Data Processing Terms

*Draft — review before publishing. Last drafted: August 25, 2026.*

These terms describe how MPC Trades ("we") processes data on your behalf
when you install BundleKit ("the app") on your Shopify store, and supplement
BundleKit's [Privacy Policy](./privacy-policy.md).

## 1. Roles

You (the merchant) are the data controller for your store's data, including
your customers' personal information. MPC Trades acts as a data processor
only for the limited configuration and aggregate analytics data described
below — we are never a processor of your customers' personal information,
because we don't access it.

## 2. What we process on your behalf

- Store configuration and offer settings you create in the app.
- Aggregate, anonymized order-revenue statistics per offer (counts and
  totals only — no customer identifiers).
- Your staff account's name/email, solely to authenticate app sessions.

We do not process your customers' names, emails, phone numbers, or
addresses under any circumstance.

## 3. Retention and deletion

All data described above is deleted automatically and immediately when you
uninstall the app, via our `app/uninstalled` webhook handler. We retain
nothing after uninstall.

## 4. Security

- All data in transit is encrypted via HTTPS/TLS.
- [Add at-rest encryption details for your production database once
  confirmed with your hosting provider.]
- Access to production data is limited to the engineers operating the app.

## 5. Sub-processors

[List your hosting/database provider(s) here, e.g. your Postgres host, once
finalized.]

## 6. Your rights

You may request details of what data we hold for your store, or request its
deletion, at any time by contacting team@mapetitecoree.com — though in
practice, uninstalling the app has the same effect.

## 7. Changes

We'll notify merchants of material changes to these terms via the contact
email on file.

---
**Before publishing**: have this reviewed by whoever handles legal/compliance
for MPC Trades. This is a starter draft, not a substitute for legal advice —
adjust jurisdiction-specific language (GDPR/CCPA/etc.) as needed for your
merchant base.
