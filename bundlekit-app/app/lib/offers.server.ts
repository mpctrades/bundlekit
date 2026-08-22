/**
 * Everything that turns an Offer row into something Shopify can execute.
 *
 * On save we do exactly three things:
 *   1. resolve the offer's target into a concrete list of product ids
 *   2. write the offer JSON onto each product as a metafield (the widget reads
 *      this in Liquid, so the storefront needs no network call at render time)
 *   3. create or update one automatic app discount whose config metafield the
 *      Function reads at checkout
 *
 * The product metafield is the single source of truth. Widget and Function read
 * the same bytes, which is why the price on the page and the price at checkout
 * cannot drift apart.
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { normaliseTiers, type Tier } from "./pricing";

export const METAFIELD_NAMESPACE = "bundlekit";
export const METAFIELD_KEY = "offer";

export interface OfferConfig {
  v: 1;
  id: string;
  kind: "quantity" | "companion";
  /** Shown as the widget heading, e.g. "Bundle & save". */
  title: Record<string, string>;
  /** Shown in the cart and on the order, e.g. "BundleKit — buy 2, save 10%". */
  discountLabel: string;
  tiers: Tier[];
  companions?: Array<{
    variantId: string;
    productId: string;
    title: string;
    priceCents: number;
    image: string | null;
  }>;
  companionDiscount?: { type: Tier["type"]; value: number };
  design: {
    accent: string;
    radius: number;
    showTrustLine: boolean;
    /** "amount" | "percentage" | "both" — mirrors Shop.defaultSavingsDisplay. */
    savingsDisplay?: string;
    /** "outline" | "soft" — mirrors Shop.defaultCardStyle. */
    cardStyle?: string;
  };
  labels: Record<string, Record<string, string>>;
}

/* ------------------------------------------------------------------ */
/* 1. Resolve targeting (F6)                                           */
/* ------------------------------------------------------------------ */

const PRODUCTS_IN_COLLECTION = `#graphql
  query ProductsInCollection($id: ID!, $cursor: String) {
    collection(id: $id) {
      products(first: 250, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id }
      }
    }
  }`;

const ALL_PRODUCTS = `#graphql
  query AllProducts($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes { id }
    }
  }`;

interface ProductsPage {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: Array<{ id: string }>;
}

export async function resolveTargetProducts(
  admin: AdminApiContext,
  targetType: string,
  targetIds: string[],
): Promise<string[]> {
  if (targetType === "products") return targetIds;

  const ids: string[] = [];
  const query = targetType === "collection" ? PRODUCTS_IN_COLLECTION : ALL_PRODUCTS;

  const collectIds = async (collectionId?: string): Promise<void> => {
    let cursor: string | null = null;
    let guard = 0;
    do {
      const response: Response = await admin.graphql(query, {
        variables: collectionId ? { id: collectionId, cursor } : { cursor },
      });
      const body: {
        data?: {
          collection?: { products?: ProductsPage };
          products?: ProductsPage;
        };
      } = await response.json();
      const page = collectionId ? body.data?.collection?.products : body.data?.products;
      if (!page) break;
      for (const node of page.nodes) ids.push(node.id);
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
      guard += 1;
    } while (cursor && guard < 200); // 50k products is a sane ceiling for v1
  };

  if (targetType === "collection") {
    for (const collectionId of targetIds) await collectIds(collectionId);
  } else {
    await collectIds();
  }
  return [...new Set(ids)];
}

/** Display data for a targeted product or collection — enough for the
 *  builder to show a thumbnail and title instead of a raw gid. */
export interface ResourceSummary {
  id: string;
  title: string;
  image: string | null;
  subtitle?: string;
}

const RESOURCE_SUMMARIES = `#graphql
  query ResourceSummaries($ids: [ID!]!) {
    nodes(ids: $ids) {
      id
      ... on Product {
        title
        status
        featuredImage { url altText }
      }
      ... on Collection {
        title
        image { url altText }
      }
    }
  }`;

/** Batched lookup so the offer builder can render thumbnails for targets
 *  that were already saved (only their gids live in the database). */
export async function fetchResourceSummaries(
  admin: AdminApiContext,
  ids: string[],
): Promise<ResourceSummary[]> {
  if (ids.length === 0) return [];

  const summaries: ResourceSummary[] = [];
  for (const batch of chunk(ids, 50)) {
    const response = await admin.graphql(RESOURCE_SUMMARIES, { variables: { ids: batch } });
    const body = await response.json();
    const nodes: Array<{
      id: string;
      title?: string;
      status?: string;
      featuredImage?: { url: string } | null;
      image?: { url: string } | null;
    } | null> = body.data?.nodes ?? [];

    for (const node of nodes) {
      if (!node || !node.title) continue; // deleted since the offer was saved
      summaries.push({
        id: node.id,
        title: node.title,
        image: node.featuredImage?.url ?? node.image?.url ?? null,
        subtitle: node.status === "ARCHIVED" ? "Archived" : node.status === "DRAFT" ? "Unpublished" : undefined,
      });
    }
  }
  return summaries;
}

/* ------------------------------------------------------------------ */
/* 2. Write the offer onto the products                                */
/* ------------------------------------------------------------------ */

const METAFIELDS_SET = `#graphql
  mutation SetOfferMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message }
    }
  }`;

const METAFIELD_DELETE = `#graphql
  mutation DeleteOfferMetafields($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      userErrors { field message }
    }
  }`;

const DEFINITION_CREATE = `#graphql
  mutation CreateOfferDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      userErrors { field message code }
    }
  }`;

/** Idempotent. Storefront read access is what lets Liquid see the offer. */
export async function ensureMetafieldDefinition(admin: AdminApiContext) {
  const response = await admin.graphql(DEFINITION_CREATE, {
    variables: {
      definition: {
        name: "BundleKit offer",
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEY,
        description: "Offer shown by the BundleKit product-page widget.",
        ownerType: "PRODUCT",
        type: "json",
        access: { admin: "MERCHANT_READ", storefront: "PUBLIC_READ" },
      },
    },
  });
  const body = await response.json();
  const errors = body.data?.metafieldDefinitionCreate?.userErrors ?? [];
  // TAKEN just means we already created it on a previous save.
  const real = errors.filter((error: { code?: string }) => error.code !== "TAKEN");
  if (real.length) console.warn("[bundlekit] definition warnings", real);
}

export async function writeOfferToProducts(
  admin: AdminApiContext,
  productIds: string[],
  config: OfferConfig,
) {
  const value = JSON.stringify(config);
  const writeBatch = async (batch: string[]) => {
    const response = await admin.graphql(METAFIELDS_SET, {
      variables: {
        metafields: batch.map((ownerId) => ({
          ownerId,
          namespace: METAFIELD_NAMESPACE,
          key: METAFIELD_KEY,
          type: "json",
          value,
        })),
      },
    });
    const body = await response.json();
    const errors = body.data?.metafieldsSet?.userErrors ?? [];
    if (errors.length) throw new Error(`metafieldsSet: ${JSON.stringify(errors)}`);
  };

  // A handful of chunks in flight at once is a big win for larger catalogs
  // without tripping the Admin API's leaky-bucket rate limit.
  const CONCURRENCY = 4;
  const batches = chunk(productIds, 25);
  for (const group of chunk(batches, CONCURRENCY)) {
    await Promise.all(group.map(writeBatch));
  }
}

export async function clearOfferFromProducts(admin: AdminApiContext, productIds: string[]) {
  for (const batch of chunk(productIds, 25)) {
    await admin.graphql(METAFIELD_DELETE, {
      variables: {
        metafields: batch.map((ownerId) => ({
          ownerId,
          namespace: METAFIELD_NAMESPACE,
          key: METAFIELD_KEY,
        })),
      },
    });
  }
}

/* ------------------------------------------------------------------ */
/* 3. The automatic discount that runs our Function                    */
/* ------------------------------------------------------------------ */

const FIND_FUNCTION = `#graphql
  query FindBundleKitFunction {
    shopifyFunctions(first: 50) {
      nodes { id title apiType }
    }
  }`;

const DISCOUNT_CREATE = `#graphql
  mutation CreateBundleDiscount($discount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $discount) {
      automaticAppDiscount { discountId }
      userErrors { field message }
    }
  }`;

const DISCOUNT_UPDATE = `#graphql
  mutation UpdateBundleDiscount($id: ID!, $discount: DiscountAutomaticAppInput!) {
    discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $discount) {
      userErrors { field message }
    }
  }`;

const DISCOUNT_ACTIVATE = `#graphql
  mutation ActivateBundleDiscount($id: ID!) {
    discountAutomaticActivate(id: $id) {
      userErrors { field message }
    }
  }`;

const DISCOUNT_DEACTIVATE = `#graphql
  mutation DeactivateBundleDiscount($id: ID!) {
    discountAutomaticDeactivate(id: $id) {
      userErrors { field message }
    }
  }`;

const DISCOUNT_DELETE = `#graphql
  mutation DeleteBundleDiscount($id: ID!) {
    discountAutomaticDelete(id: $id) {
      userErrors { field message }
    }
  }`;

export async function findFunctionId(admin: AdminApiContext): Promise<string> {
  const response = await admin.graphql(FIND_FUNCTION);
  const body = await response.json();
  const nodes = body.data?.shopifyFunctions?.nodes ?? [];
  const match =
    nodes.find((node: { apiType: string }) => node.apiType === "product_discounts") ??
    nodes.find((node: { title: string }) => /bundlekit/i.test(node.title));
  if (!match) {
    throw new Error(
      "No product discount Function found. Run `shopify app deploy` so the " +
        "bundlekit-discount extension exists on this shop, then save again.",
    );
  }
  return match.id;
}

/**
 * One discount per offer. Its config metafield carries the tiers, so the
 * Function needs no database and no network at checkout time.
 */
export async function syncDiscount(
  admin: AdminApiContext,
  offer: { id: string; name: string; discountGid: string | null },
  config: OfferConfig,
  functionId: string,
  combinesWith: { orderDiscounts: boolean; productDiscounts: boolean; shippingDiscounts: boolean },
  schedule: { startsAt: Date; endsAt: Date | null } = { startsAt: new Date(), endsAt: null },
): Promise<string> {
  const input = {
    title: `BundleKit — ${offer.name}`,
    functionId,
    startsAt: schedule.startsAt.toISOString(),
    endsAt: schedule.endsAt ? schedule.endsAt.toISOString() : null,
    combinesWith,
    metafields: [
      {
        namespace: "$app:bundlekit",
        key: "config",
        type: "json",
        value: JSON.stringify({
          offerId: config.id,
          kind: config.kind,
          tiers: normaliseTiers(config.tiers),
          companionDiscount: config.companionDiscount ?? null,
          label: config.discountLabel,
        }),
      },
    ],
  };

  if (offer.discountGid) {
    const response = await admin.graphql(DISCOUNT_UPDATE, {
      variables: { id: offer.discountGid, discount: input },
    });
    const body = await response.json();
    const errors = body.data?.discountAutomaticAppUpdate?.userErrors ?? [];
    if (errors.length) throw new Error(`discount update: ${JSON.stringify(errors)}`);
    return offer.discountGid;
  }

  const response = await admin.graphql(DISCOUNT_CREATE, { variables: { discount: input } });
  const body = await response.json();
  const errors = body.data?.discountAutomaticAppCreate?.userErrors ?? [];
  if (errors.length) throw new Error(`discount create: ${JSON.stringify(errors)}`);
  return body.data.discountAutomaticAppCreate.automaticAppDiscount.discountId;
}

/* ------------------------------------------------------------------ */
/* 3b. Conflict protection (F5)                                        */
/* ------------------------------------------------------------------ */

/** Specific products always win over a collection, which always wins over
 *  "all products" — the default priority rule merchants are shown. */
const TARGET_PRIORITY: Record<string, number> = { products: 3, collection: 2, all: 1 };

export interface OfferConflict {
  offerId: string;
  name: string;
  overlapCount: number;
  /** Who applies to the overlapping products once both offers are live. */
  winner: "current" | "other" | "ambiguous";
}

/**
 * Compares one offer's candidate target products against every other LIVE
 * offer on the shop. Two offers at the same priority tier that share a
 * product are ambiguous — Shopify has no defined order between two
 * automatic discounts of the same class, so we refuse to guess. Different
 * tiers are just informational: the merchant is told who wins, not blocked.
 */
export async function checkConflicts(
  admin: AdminApiContext,
  shopId: string,
  currentOffer: { id: string; targetType: string },
  candidateProductIds: string[],
): Promise<OfferConflict[]> {
  if (candidateProductIds.length === 0) return [];
  const candidateSet = new Set(candidateProductIds);

  const others = await prisma.offer.findMany({
    where: { shopId, status: "live", id: { not: currentOffer.id } },
    select: { id: true, name: true, targetType: true, targetIds: true, resolvedProductIds: true },
  });

  const currentPriority = TARGET_PRIORITY[currentOffer.targetType] ?? 1;
  const conflicts: OfferConflict[] = [];

  for (const other of others) {
    // Older live offers published before this column existed may not have a
    // snapshot yet — fall back to resolving them on the fly this one time.
    const otherProductIds = other.resolvedProductIds.length
      ? other.resolvedProductIds
      : await resolveTargetProducts(admin, other.targetType, other.targetIds);

    const overlapCount = otherProductIds.filter((id) => candidateSet.has(id)).length;
    if (overlapCount === 0) continue;

    const otherPriority = TARGET_PRIORITY[other.targetType] ?? 1;
    const winner: OfferConflict["winner"] =
      currentPriority === otherPriority ? "ambiguous" : currentPriority > otherPriority ? "current" : "other";

    conflicts.push({ offerId: other.id, name: other.name, overlapCount, winner });
  }

  return conflicts;
}

/* ------------------------------------------------------------------ */
/* Publish: the whole thing, in order                                  */
/* ------------------------------------------------------------------ */

export async function publishOffer(
  admin: AdminApiContext,
  offerId: string,
  combinesWith = { orderDiscounts: false, productDiscounts: false, shippingDiscounts: true },
  // Callers that already resolved the target (e.g. to run checkConflicts
  // first) pass it here so we don't hit the Admin API a second time.
  preResolvedProductIds?: string[],
  // Null startsAt means "start immediately" (F9).
  schedule: { startsAt: Date | null; endsAt: Date | null } = { startsAt: null, endsAt: null },
) {
  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: offerId } });
  const config = offer.config as unknown as OfferConfig;
  const startsAt = schedule.startsAt ?? new Date();

  // These three don't depend on each other, so run them together instead of
  // back-to-back — each is a full round trip to the Admin API.
  const [, productIds, functionId] = await Promise.all([
    ensureMetafieldDefinition(admin),
    preResolvedProductIds ?? resolveTargetProducts(admin, offer.targetType, offer.targetIds),
    findFunctionId(admin),
  ]);

  await writeOfferToProducts(admin, productIds, config);
  const discountGid = await syncDiscount(admin, offer, config, functionId, combinesWith, {
    startsAt,
    endsAt: schedule.endsAt,
  });

  return prisma.offer.update({
    where: { id: offerId },
    data: {
      status: "live",
      discountGid,
      productCount: productIds.length,
      resolvedProductIds: productIds,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Pause / resume / duplicate / delete — offer lifecycle actions       */
/* ------------------------------------------------------------------ */

export type DisplayStatus = "draft" | "scheduled" | "live" | "paused";

/** What the merchant actually sees as a status pill. `status` alone can't
 *  distinguish "live but starts next week" from "live right now" — that
 *  needs comparing the schedule against the clock, so it's derived here
 *  rather than stored. */
export function computeDisplayStatus(
  offer: { status: string; startsAt: Date | null; endsAt: Date | null },
  now: Date = new Date(),
): DisplayStatus {
  if (offer.status !== "live") return offer.status === "paused" ? "paused" : "draft";
  if (offer.startsAt && offer.startsAt > now) return "scheduled";
  if (offer.endsAt && offer.endsAt < now) return "paused"; // ended
  return "live";
}

/** Stops the discount without losing the offer's configuration — the
 *  merchant can resume later and everything (tiers, target, design) is
 *  exactly as it was. */
export async function pauseOffer(admin: AdminApiContext, offerId: string) {
  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: offerId } });
  if (offer.discountGid) {
    const response = await admin.graphql(DISCOUNT_DEACTIVATE, { variables: { id: offer.discountGid } });
    const body = await response.json();
    const errors = body.data?.discountAutomaticDeactivate?.userErrors ?? [];
    if (errors.length) throw new Error(`discount deactivate: ${JSON.stringify(errors)}`);
  }
  return prisma.offer.update({ where: { id: offerId }, data: { status: "paused" } });
}

export async function resumeOffer(admin: AdminApiContext, offerId: string) {
  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: offerId } });
  if (!offer.discountGid) {
    throw new Error("This offer was never published, so there's nothing to resume — publish it instead.");
  }
  const response = await admin.graphql(DISCOUNT_ACTIVATE, { variables: { id: offer.discountGid } });
  const body = await response.json();
  const errors = body.data?.discountAutomaticActivate?.userErrors ?? [];
  if (errors.length) throw new Error(`discount activate: ${JSON.stringify(errors)}`);
  return prisma.offer.update({ where: { id: offerId }, data: { status: "live" } });
}

/** A copy always starts as an unpublished draft — duplicating a live offer
 *  must never silently create a second live discount targeting the same
 *  products (that would trip conflict protection the moment it's published,
 *  which is the correct, expected behaviour). */
export async function duplicateOffer(offerId: string, shopId: string) {
  const source = await prisma.offer.findFirstOrThrow({ where: { id: offerId, shopId } });
  const sourceConfig = source.config as unknown as OfferConfig;

  const copy = await prisma.offer.create({
    data: {
      shopId,
      name: `${source.name} (copy)`,
      kind: source.kind,
      status: "draft",
      targetType: source.targetType,
      targetIds: source.targetIds,
      combineProduct: source.combineProduct,
      combineOrder: source.combineOrder,
      config: { ...sourceConfig, id: "pending" } as never,
    },
  });

  return prisma.offer.update({
    where: { id: copy.id },
    data: { config: { ...sourceConfig, id: copy.id } as never },
  });
}

/** Removing an offer removes every trace of it from the storefront too —
 *  the metafield on each product it touched, and the discount itself. */
export async function deleteOffer(admin: AdminApiContext, offerId: string, shopId: string) {
  const offer = await prisma.offer.findFirstOrThrow({ where: { id: offerId, shopId } });

  if (offer.resolvedProductIds.length) {
    await clearOfferFromProducts(admin, offer.resolvedProductIds);
  }
  if (offer.discountGid) {
    const response = await admin.graphql(DISCOUNT_DELETE, { variables: { id: offer.discountGid } });
    const body = await response.json();
    const errors = body.data?.discountAutomaticDelete?.userErrors ?? [];
    if (errors.length) throw new Error(`discount delete: ${JSON.stringify(errors)}`);
  }
  await prisma.offer.delete({ where: { id: offerId } });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
