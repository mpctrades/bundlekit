# BundleKit Privacy Policy

*Published at bundlekit-web/privacy.html. Last updated: August 28, 2026.*

This policy describes how BundleKit ("the app"), provided by MPC Trades,
handles data when a merchant installs it on a Shopify store.

## What we access and why

| Scope requested | Why |
|---|---|
| `read_products`, `write_products` | Show your catalog in the offer builder and write the metafield an offer needs |
| `write_discounts` | Create the automatic discount that powers each offer |
| `read_orders` | Read the price and quantity of order line items tagged by the widget, so we can total revenue attributed to each offer |

## What we do NOT collect

BundleKit never reads, stores, or transmits your customers' personal
information. Specifically, we do not access customer names, email addresses,
phone numbers, or shipping/billing addresses, even though our `read_orders`
scope makes the order object available to us. Our order-webhook handler
reads only `line_items` (price, quantity, and an internal `_bundlekit` tag)
— nothing else in the order payload is read or persisted.

## What we do store

- **Store configuration**: your shop domain, currency, locale, and the
  widget/discount design defaults you set.
- **Offer configuration**: the bundles/quantity breaks you build — product
  or collection IDs, pricing rules, and status. No customer data.
- **Aggregate performance stats**: daily counts of widget views, selects,
  orders, and revenue **per offer** — never tied to an individual customer
  or order.
- **Your staff account info**: the name and email of the staff account that
  installs/authenticates the app, provided by Shopify during login. This is
  standard OAuth session data used only to keep you signed in — it is never
  shared or used for marketing.

## Data retention

When you uninstall BundleKit, our uninstall handler immediately deletes your
shop's session, configuration, offers, and stats. No data is retained after
uninstall.

## Data sharing

We do not sell or share your data with third parties. We do not use your
data for advertising.

## Security

Data is transmitted over HTTPS/TLS.

## Your rights

Shopify merchants and their customers can request data access or deletion
per Shopify's standard data subject request process. We support Shopify's
mandatory compliance webhooks: `customers/data_request`, `customers/redact`,
and `shop/redact`.

## Contact

Questions about this policy: team@mpctrades.com

## Changes

We'll update this policy as the app's data use changes and note the date at
the top.
