import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { shopifyApi } from "@shopify/shopify-api";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { migrateAllSessions, migrateSession, needsMigration } from "./lib/token-migration.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26, // pin; matches the version in shopify.app.toml
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    // Non-expiring offline tokens are deprecated (Dev Dashboard alert).
    // Needs the refreshToken columns in prisma/schema.prisma.
    expiringOfflineAccessTokens: true,
  },
});

// shopifyApp() doesn't expose its internal API object, and only the plain
// library has the token migration call. Same credentials and version.
const tokenApi = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: process.env.SCOPES?.split(","),
  hostName: (process.env.SHOPIFY_APP_URL || "https://localhost").replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
  isEmbeddedApp: true,
});

const migrationDeps = {
  migrate: tokenApi.auth.migrateToExpiringToken,
  store: (session: Parameters<typeof shopify.sessionStorage.storeSession>[0]) =>
    shopify.sessionStorage.storeSession(session),
};

// authenticate.admin() only throws Responses for the auth flows it knows
// about. A forged or mismatched request — a garbage `host` param
// (sanitizeHost's `new URL` throws TypeError), or a session token for a shop
// that never installed the app (token exchange rejects) — escapes as a plain
// error, and React Router answers 500. App Review's cross-shop security scan
// sends exactly those requests and flags every 500. Reject them as 401.
const authenticateAdmin: typeof shopify.authenticate.admin = async (request) => {
  try {
    const context = await shopify.authenticate.admin(request);
    // A shop installed before expiring tokens still holds a permanent one.
    // Swap it now, then re-authenticate so this request's Admin API client
    // uses the new token (the exchange invalidates the old one).
    if (needsMigration(context.session) && (await migrateSession(context.session, migrationDeps))) {
      return await shopify.authenticate.admin(request);
    }
    return context;
  } catch (error) {
    // The library also answers a failed token exchange (e.g. a token for a
    // shop that doesn't exist) with its own bare 500 Response.
    if (error instanceof Response && error.status < 500) throw error;
    const shop = new URL(request.url).searchParams.get("shop");
    console.warn(
      "[bundlekit] rejected admin request",
      { shop },
      error instanceof Response ? `library ${error.status}` : error instanceof Error ? error.message : error,
    );
    throw new Response("Unauthorized", { status: 401 });
  }
};

// Shops that never open the app (background-only use: webhooks, the
// storefront beacon) would otherwise keep their permanent token, so sweep
// them once shortly after the server starts. Safe to repeat: migrated
// sessions no longer match, and a failed shop is retried on the next boot
// or the next time its merchant opens the app.
if (process.env.NODE_ENV === "production" && !globalThis.__bundlekitTokenSweep) {
  globalThis.__bundlekitTokenSweep = true;
  setTimeout(async () => {
    try {
      const sessions = await prisma.session.findMany({
        where: { isOnline: false, refreshToken: null, expires: null },
        select: { id: true, shop: true, isOnline: true, accessToken: true, refreshToken: true, expires: true },
      });
      if (sessions.length === 0) return;
      const result = await migrateAllSessions(sessions, migrationDeps);
      console.info("[bundlekit] offline token sweep", { found: sessions.length, ...result });
    } catch (error) {
      console.warn("[bundlekit] offline token sweep failed", error instanceof Error ? error.message : error);
    }
  }, 15_000).unref();
}

declare global {
  // eslint-disable-next-line no-var
  var __bundlekitTokenSweep: boolean | undefined;
}

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = { ...shopify.authenticate, admin: authenticateAdmin };
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
