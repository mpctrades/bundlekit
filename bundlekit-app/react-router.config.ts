import type { Config } from "@react-router/dev/config";

// Lazy route discovery (the default) has the client fetch /__manifest on
// every navigation to a not-yet-loaded route. That path 404s in production
// (the reverse proxy in front of this app isn't routing it to Node), which
// breaks React Router's client-side router entirely — every sidebar
// navigation and every form submit crashed to the app's error boundary.
// "initial" embeds the full route manifest in the first HTML response
// instead, so the client never needs to fetch it.
export default { ssr: true, routeDiscovery: { mode: "initial" } } satisfies Config;
