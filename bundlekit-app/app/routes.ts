import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/*", "routes/auth.$.tsx"),
  route("app", "routes/app.tsx", [
    index("routes/app._index.tsx"),
    route("offers", "routes/app.offers._index.tsx", { id: "offers-index" }),
    route("offers/:id", "routes/app.offers.$id.tsx"),
    route("design", "routes/app.design.tsx"),
    route("analytics", "routes/app.analytics.tsx"),
    route("settings", "routes/app.settings.tsx"),
    route("billing", "routes/app.billing.tsx"),
  ]),
  route("webhooks/app/uninstalled", "routes/webhooks.app.uninstalled.tsx"),
  route("webhooks/app/scopes_update", "routes/webhooks.app.scopes_update.tsx"),
  route("webhooks/orders/create", "routes/webhooks.orders.create.tsx"),
  route("webhooks/compliance", "routes/webhooks.compliance.tsx"),
  route("api/beacon", "routes/api.beacon.tsx"),
] satisfies RouteConfig;
