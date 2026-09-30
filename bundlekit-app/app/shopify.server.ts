import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

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

// authenticate.admin() only throws Responses for the auth flows it knows
// about. A forged or mismatched request — a garbage `host` param
// (sanitizeHost's `new URL` throws TypeError), or a session token for a shop
// that never installed the app (token exchange rejects) — escapes as a plain
// error, and React Router answers 500. App Review's cross-shop security scan
// sends exactly those requests and flags every 500. Reject them as 401.
const authenticateAdmin: typeof shopify.authenticate.admin = async (request) => {
  try {
    return await shopify.authenticate.admin(request);
  } catch (error) {
    if (error instanceof Response) throw error;
    const shop = new URL(request.url).searchParams.get("shop");
    console.warn(
      "[bundlekit] rejected admin request",
      { shop },
      error instanceof Error ? error.message : error,
    );
    throw new Response("Unauthorized", { status: 401 });
  }
};

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = { ...shopify.authenticate, admin: authenticateAdmin };
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
