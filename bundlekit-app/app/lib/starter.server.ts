import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { rankBestSellers } from "./starters";

export interface StarterProduct {
  id: string;
  title: string;
  image: string | null;
}

const RECENT_ORDER_LINES = `#graphql
  query StarterRecentOrders {
    orders(first: 50, sortKey: CREATED_AT, reverse: true) {
      nodes {
        lineItems(first: 20) {
          nodes { quantity product { id status } }
        }
      }
    }
  }`;

const PRODUCTS_BY_IDS = `#graphql
  query StarterProductsByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product { id title status featuredMedia { preview { image { url } } } }
    }
  }`;

const NEWEST_PRODUCTS = `#graphql
  query StarterNewestProducts($first: Int!) {
    products(first: $first, sortKey: CREATED_AT, reverse: true, query: "status:active") {
      nodes { id title status featuredMedia { preview { image { url } } } }
    }
  }`;

type ProductNode = {
  id?: string;
  title?: string;
  status?: string;
  featuredMedia?: { preview?: { image?: { url?: string } | null } | null } | null;
} | null;

function toStarterProducts(nodes: ProductNode[]): StarterProduct[] {
  return nodes
    .filter((node): node is NonNullable<ProductNode> => !!node?.id && !!node.title && node.status === "ACTIVE")
    .map((node) => ({ id: node.id!, title: node.title!, image: node.featuredMedia?.preview?.image?.url ?? null }));
}

/**
 * Products to pre-fill the starter offers with: the store's best sellers from
 * its last 50 orders, topped up with its newest active products for a new
 * store with few or no orders. Never throws — the Dashboard must still load,
 * and the merchant can always pick products by hand.
 */
export async function fetchStarterProducts(admin: AdminApiContext, limit = 3): Promise<StarterProduct[]> {
  const picked: StarterProduct[] = [];
  try {
    const response = await admin.graphql(RECENT_ORDER_LINES);
    const body = await response.json();
    const lines = (body.data?.orders?.nodes ?? []).flatMap(
      (order: { lineItems?: { nodes?: Array<{ quantity: number; product: { id: string; status: string } | null }> } }) =>
        (order.lineItems?.nodes ?? []).map((line) => ({
          productId: line.product?.status === "ACTIVE" ? line.product.id : null,
          quantity: line.quantity,
        })),
    );
    const ranked = rankBestSellers(lines, limit);
    if (ranked.length) {
      const products = await admin.graphql(PRODUCTS_BY_IDS, { variables: { ids: ranked } });
      const productsBody = await products.json();
      picked.push(...toStarterProducts(productsBody.data?.nodes ?? []));
    }
  } catch (error) {
    // e.g. order access not granted on this shop — fall through to newest.
    console.warn("[bundlekit] starter best-seller lookup failed", error);
  }

  if (picked.length < limit) {
    try {
      const response = await admin.graphql(NEWEST_PRODUCTS, { variables: { first: limit + picked.length } });
      const body = await response.json();
      const seen = new Set(picked.map((product) => product.id));
      for (const product of toStarterProducts(body.data?.products?.nodes ?? [])) {
        if (picked.length >= limit) break;
        if (!seen.has(product.id)) picked.push(product);
      }
    } catch (error) {
      console.warn("[bundlekit] starter newest-product lookup failed", error);
    }
  }
  return picked.slice(0, limit);
}
