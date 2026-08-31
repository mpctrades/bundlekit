import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Collapsible,
  ContextualSaveBar,
  EmptyState,
  InlineStack,
  Layout,
  Page,
  RadioButton,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import {
  isRouteErrorResponse,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useRouteError,
  useSubmit,
} from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShop } from "../lib/shop.server";
import {
  checkConflicts,
  computeDisplayStatus,
  fetchResourceSummaries,
  publishOffer,
  resolveTargetProducts,
  type OfferConfig,
} from "../lib/offers.server";
import { DEFAULT_TIERS, normaliseTiers, type DiscountType, type Tier } from "../lib/pricing";
import { getActivePlan } from "../lib/billing.server";
import { getOfferLimit } from "../lib/billing";
import { themeEditorDeepLink } from "../lib/theme";
import { friendlyErrorMessage } from "../lib/errors";
import { OfferPreview, type CardStyle, type SavingsDisplay } from "../components/OfferPreview";
import { Panel } from "../components/Panel";
import { ResourcePickerField, type PickedResource } from "../components/ResourcePickerField";
import { StatusPill } from "../components/StatusPill";
import { useToast } from "../components/ToastProvider";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const previewDesign = { savingsDisplay: shop.defaultSavingsDisplay as SavingsDisplay, cardStyle: shop.defaultCardStyle as CardStyle };

  if (params.id === "new") {
    const [plan, offerCount] = await Promise.all([
      getActivePlan(admin),
      prisma.offer.count({ where: { shopId: shop.id } }),
    ]);
    if (offerCount >= getOfferLimit(plan)) {
      return { limitReached: true as const, plan };
    }
    return {
      offer: {
        id: "new",
        name: "Buy more, save more",
        kind: "quantity",
        status: "draft",
        targetType: "products",
        targetResources: [] as PickedResource[],
        resourceLoadError: false,
        tiers: DEFAULT_TIERS,
        accent: shop.defaultAccent,
        combineProduct: shop.combineProductDefault,
        combineOrder: shop.combineOrderDefault,
        startsAt: null as Date | null,
        endsAt: null as Date | null,
        displayStatus: "draft" as const,
      },
      shopDomain: shop.domain,
      badgeText: shop.defaultBadgeText,
      previewDesign,
    };
  }

  const offer = await prisma.offer.findFirst({
    where: { id: params.id, shopId: shop.id },
  });
  // A missing offer (deleted from another tab, stale list, bad link) must
  // surface as a normal 404 the route can render — an uncaught Prisma error
  // here would otherwise bubble past this route's ErrorBoundary.
  if (!offer) {
    throw new Response("Offer not found", { status: 404 });
  }
  const config = offer.config as unknown as OfferConfig;

  // The database only ever stores gids — resolve them to titles/thumbnails
  // so the builder never has to show a merchant a raw Shopify id. This call
  // can fail independently of everything else here (e.g. a scope the shop
  // hasn't re-approved since it was added) — that must degrade to a banner,
  // not take the whole page down. Losing the offer builder because a
  // display-name lookup failed would be a worse outcome than showing raw ids.
  let targetResources: PickedResource[] = [];
  let resourceLoadError = false;
  if (offer.targetType !== "all") {
    try {
      targetResources = await fetchResourceSummaries(admin, offer.targetIds);
    } catch {
      resourceLoadError = true;
      targetResources = offer.targetIds.map((id) => ({ id, title: "Unable to load name", image: null }));
    }
  }

  return {
    offer: {
      id: offer.id,
      name: offer.name,
      kind: offer.kind,
      status: offer.status,
      targetType: offer.targetType,
      targetResources,
      resourceLoadError,
      tiers: config.tiers ?? DEFAULT_TIERS,
      accent: config.design?.accent ?? shop.defaultAccent,
      combineProduct: offer.combineProduct,
      combineOrder: offer.combineOrder,
      startsAt: offer.startsAt,
      endsAt: offer.endsAt,
      // Computed here (not client-side) so it's a plain Date comparison
      // against real Prisma values, not something re-derived from whatever
      // shape dates happen to cross the server/client boundary in.
      displayStatus: computeDisplayStatus(offer),
    },
    shopDomain: shop.domain,
    badgeText: shop.defaultBadgeText,
    previewDesign,
  };
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const shop = await getOrCreateShop(session.shop);

  // Belt-and-suspenders: the "new" loader already hides the builder once a
  // shop is at its plan's offer limit, but that's a UI nicety, not a lock —
  // a direct POST (or a stale tab) must not be able to create past it.
  if (params.id === "new") {
    const [plan, offerCount] = await Promise.all([
      getActivePlan(admin),
      prisma.offer.count({ where: { shopId: shop.id } }),
    ]);
    if (offerCount >= getOfferLimit(plan)) {
      return { error: "You've reached your plan's offer limit. Upgrade to add more offers." };
    }
  }

  const name = String(form.get("name") || "Untitled offer");
  const targetType = String(form.get("targetType") || "products");
  const expectedResource = targetType === "collection" ? "Collection" : "Product";
  // The resource picker only ever returns real gids, but validate anyway —
  // targetIds still travels through a plain form field.
  const targetIds = (JSON.parse(String(form.get("targetIds") || "[]")) as string[])
    .map((value) => value.trim())
    .filter(Boolean);
  const tiers = normaliseTiers(JSON.parse(String(form.get("tiers") || "[]")) as Tier[]);
  const accent = String(form.get("accent") || shop.defaultAccent);
  const combineProduct = form.get("combineProduct") === "on";
  const combineOrder = form.get("combineOrder") === "on";

  // Schedule (F9). Dates arrive as UTC ISO strings — the client converts the
  // merchant's local datetime-local input before submitting, so there's no
  // server/browser timezone ambiguity to resolve here.
  const scheduleMode = String(form.get("scheduleMode") || "immediate");
  const startsAtRaw = String(form.get("startsAt") || "");
  const endsAtRaw = String(form.get("endsAt") || "");
  const startsAt = scheduleMode === "scheduled" && startsAtRaw ? new Date(startsAtRaw) : null;
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;

  if (!tiers.length) {
    return { error: "Add at least one tier of two units or more." };
  }
  if (targetType !== "all" && targetIds.length === 0) {
    return {
      error:
        targetType === "collection"
          ? "Select at least one collection for this offer."
          : "Select at least one product for this offer.",
      field: "targetIds" as const,
    };
  }
  const mismatched = targetIds.find((id) => !id.includes(`/${expectedResource}/`));
  if (mismatched) {
    return {
      error: "Something went wrong picking your target — try selecting it again.",
      field: "targetIds" as const,
    };
  }
  if (scheduleMode === "scheduled" && !startsAt) {
    return { error: "Choose a start date and time, or switch back to starting immediately.", field: "schedule" as const };
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    return { error: "The end date must be after the start date.", field: "schedule" as const };
  }

  const offerId = params.id === "new" ? undefined : params.id!;
  const config: OfferConfig = {
    v: 1,
    id: offerId ?? "pending",
    kind: "quantity",
    title: { en: "Bundle & save", fr: "Pack & économies" },
    discountLabel: `BundleKit — ${name}`,
    tiers,
    design: {
      accent,
      radius: shop.defaultRadius,
      showTrustLine: shop.defaultShowTrustLine,
      savingsDisplay: shop.defaultSavingsDisplay,
      cardStyle: shop.defaultCardStyle,
    },
    labels: {
      en: {
        unit: "unit",
        units: "units",
        save: "save",
        regular: "Regular price",
        perUnit: "/ unit",
        badge: shop.defaultBadgeText,
        trust: "Discount applied automatically at checkout",
        addToCart: "Add {qty} to cart",
      },
      fr: {
        unit: "unité",
        units: "unités",
        save: "de remise",
        regular: "Prix normal",
        perUnit: "/ unité",
        // Shop-level badge default is EN-only for now; FR keeps its own
        // translation until per-locale defaults are added (known limitation).
        badge: "Le plus choisi",
        trust: "Remise appliquée automatiquement à la caisse",
        addToCart: "Ajouter {qty} au panier",
      },
    },
  };

  const offer = offerId
    ? await prisma.offer.update({
        where: { id: offerId },
        data: { name, targetType, targetIds, combineProduct, combineOrder, startsAt, endsAt, config: config as never },
      })
    : await prisma.offer.create({
        data: { shopId: shop.id, name, targetType, targetIds, combineProduct, combineOrder, startsAt, endsAt, config: config as never },
      });

  // The config carries its own id so the widget can beacon and the order
  // webhook can attribute revenue. Write it back now that we have one.
  await prisma.offer.update({
    where: { id: offer.id },
    data: { config: { ...config, id: offer.id } as never },
  });

  if (form.get("intent") === "publish") {
    try {
      const candidateProductIds = await resolveTargetProducts(admin, targetType, targetIds);
      const conflicts = await checkConflicts(admin, shop.id, { id: offer.id, targetType }, candidateProductIds);
      const ambiguous = conflicts.filter((conflict) => conflict.winner === "ambiguous");

      if (ambiguous.length > 0) {
        const names = ambiguous.map((conflict) => `"${conflict.name}"`).join(" and ");
        const tier = targetType === "products" ? "specific-product" : targetType === "collection" ? "collection" : "storewide";
        return {
          error: `Unable to publish — this offer's products overlap with ${names}, another live ${tier} offer. Shopify can't decide which one should apply, so edit the products on one of them, or pause ${names} first.`,
          offerId: offer.id,
        };
      }

      await publishOffer(
        admin,
        offer.id,
        { productDiscounts: combineProduct, orderDiscounts: combineOrder, shippingDiscounts: true },
        candidateProductIds,
        { startsAt: offer.startsAt, endsAt: offer.endsAt },
      );

      const overridden = conflicts.filter((conflict) => conflict.winner === "other");
      const overrides = conflicts.filter((conflict) => conflict.winner === "current");
      const plural = (count: number) => (count === 1 ? "product" : "products");
      const note =
        overridden.length > 0
          ? `Heads up: "${overridden[0].name}" targets more specific products than this offer, so it takes priority for ${overridden[0].overlapCount} shared ${plural(overridden[0].overlapCount)}.`
          : overrides.length > 0
            ? `Heads up: this offer targets more specific products than "${overrides[0].name}", so it takes priority for ${overrides[0].overlapCount} shared ${plural(overrides[0].overlapCount)}.`
            : undefined;

      return { ok: true, offerId: offer.id, note };
    } catch (error) {
      return { error: friendlyErrorMessage(error), offerId: offer.id };
    }
  }

  return { ok: true, offerId: offer.id };
};

/** datetime-local inputs show/parse LOCAL time. Converting here (not on the
 *  server) is what keeps a merchant's schedule choice from silently shifting
 *  by the gap between their timezone and the one the server happens to run
 *  in — the value that leaves the browser is always an unambiguous UTC ISO
 *  string. */
function toDatetimeLocalValue(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/** The merchant-facing version of "couldn't load product names" — leads
 *  with reassurance and one action, and puts the technical explanation
 *  behind a disclosure instead of the headline. */
function ProductAccessBanner({ shopDomain }: { shopDomain: string }) {
  const [showDetail, setShowDetail] = useState(false);
  return (
    <Banner tone="warning" title="BundleKit needs updated product access">
      <BlockStack gap="200">
        <Text as="p">
          Your offer is safe and still configured correctly. Update the app permissions so BundleKit can
          display your Shopify product names again.
        </Text>
        <InlineStack gap="300" blockAlign="center">
          <Button url={`https://${shopDomain}/admin/apps`} target="_blank">
            Update permissions
          </Button>
          <Button variant="plain" onClick={() => setShowDetail((value) => !value)}>
            {showDetail ? "Hide details" : "Learn more"}
          </Button>
        </InlineStack>
        <Collapsible id="product-access-detail" open={showDetail}>
          <Text as="p" tone="subdued" variant="bodySm">
            BundleKit couldn't fetch product or collection names from Shopify right now — this usually means
            the app needs an updated permission scope. Reinstalling or updating BundleKit from your Shopify
            admin resolves it.
          </Text>
        </Collapsible>
      </BlockStack>
    </Banner>
  );
}

export default function OfferBuilder() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const busy = navigation.state === "submitting";
  const { showToast } = useToast();
  const lastIntent = useRef<"save" | "publish" | null>(null);

  useEffect(() => {
    if (!actionData) return;
    if ("error" in actionData && actionData.error) {
      showToast(actionData.error, true);
    } else if ("ok" in actionData) {
      showToast(lastIntent.current === "publish" ? "Offer published" : "Offer saved");
    }
    // actionData is a fresh object each submission, so this only fires once per response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionData]);

  // All hooks below must run on every render regardless of which loader
  // shape came back — a limit-reached response has no `offer` to seed state
  // from, so it falls back to an empty draft that's never actually shown
  // (the branch below returns before this state is used).
  const limitReached = "limitReached" in data && data.limitReached;
  const offer = limitReached
    ? null
    : data.offer;

  const [name, setName] = useState(offer?.name ?? "");
  const [targetType, setTargetType] = useState(offer?.targetType ?? "products");
  const [targetResources, setTargetResources] = useState<PickedResource[]>(offer?.targetResources ?? []);
  const [tiers, setTiers] = useState<Tier[]>(offer?.tiers ?? DEFAULT_TIERS);
  const [accent, setAccent] = useState(offer?.accent ?? "#FF4A1C");
  const [combineProduct, setCombineProduct] = useState(offer?.combineProduct ?? false);
  const [combineOrder, setCombineOrder] = useState(offer?.combineOrder ?? false);
  const [scheduleMode, setScheduleMode] = useState<"immediate" | "scheduled">(offer?.startsAt ? "scheduled" : "immediate");
  const [startsAtLocal, setStartsAtLocal] = useState(toDatetimeLocalValue(offer?.startsAt ?? null));
  const [endsAtLocal, setEndsAtLocal] = useState(toDatetimeLocalValue(offer?.endsAt ?? null));
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  // Cheap enough to recompute every render — this is a handful of primitive
  // fields, not the tier array's contents changing shape.
  const snapshot = () =>
    JSON.stringify({
      name,
      targetType,
      targetIds: targetResources.map((resource) => resource.id).sort(),
      tiers,
      accent,
      combineProduct,
      combineOrder,
      scheduleMode,
      startsAtLocal,
      endsAtLocal,
    });
  const baselineRef = useRef(snapshot());
  const isDirty = snapshot() !== baselineRef.current;

  useEffect(() => {
    if (actionData && "ok" in actionData) {
      baselineRef.current = snapshot();
    }
    // Reset the dirty baseline only when a save actually lands — not on every
    // keystroke, which is what including `snapshot()`'s inputs here would do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionData]);

  // Mirrors the server's own validation (app.offers.$id.tsx action, above) so
  // a merchant sees the problem before round-tripping to find out — the
  // server check stays authoritative and still runs regardless.
  const clientErrors = useMemo(() => {
    const errors: Partial<Record<"tiers" | "targetIds" | "schedule", string>> = {};
    if (tiers.length === 0) {
      errors.tiers = "Add at least one tier of two units or more.";
    }
    if (targetType !== "all" && targetResources.length === 0) {
      errors.targetIds =
        targetType === "collection"
          ? "Select at least one collection for this offer."
          : "Select at least one product for this offer.";
    }
    if (scheduleMode === "scheduled" && !startsAtLocal) {
      errors.schedule = "Choose a start date and time, or switch back to starting immediately.";
    } else if (startsAtLocal && endsAtLocal) {
      const start = new Date(startsAtLocal);
      const end = new Date(endsAtLocal);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
        errors.schedule = "The end date must be after the start date.";
      }
    }
    return errors;
  }, [tiers, targetType, targetResources, scheduleMode, startsAtLocal, endsAtLocal]);
  const hasBlockingErrors = Object.keys(clientErrors).length > 0;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  if (limitReached || !offer) {
    return (
      <Page title="New offer" backAction={{ onAction: () => navigate("/app/offers") }}>
        <Layout>
          <Layout.Section>
            <Panel>
              <EmptyState
                heading="You've reached your plan's offer limit"
                action={{ content: "View plans", onAction: () => navigate("/app/billing") }}
                secondaryAction={{ content: "Back to offers", onAction: () => navigate("/app/offers") }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Upgrade your plan to create more offers.</p>
              </EmptyState>
            </Panel>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const { shopDomain, badgeText, previewDesign } = data;
  const previewUnitPrice = 1990; // €19.90, the preview product

  const update = (index: number, patch: Partial<Tier>) =>
    setTiers((current) => current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));

  // Products and collections are different resource types, so switching
  // between them makes any prior selection meaningless — clear it rather
  // than silently submitting the wrong kind of gid.
  const changeTargetType = (value: string) => {
    setTargetType(value);
    setTargetResources([]);
  };

  const save = (intent: "save" | "publish") => {
    lastIntent.current = intent;
    const form = new FormData();
    form.set("intent", intent);
    form.set("name", name);
    form.set("targetType", targetType);
    form.set("targetIds", JSON.stringify(targetResources.map((resource) => resource.id)));
    form.set("tiers", JSON.stringify(tiers));
    form.set("accent", accent);
    if (combineProduct) form.set("combineProduct", "on");
    if (combineOrder) form.set("combineOrder", "on");
    form.set("scheduleMode", scheduleMode);
    form.set("startsAt", scheduleMode === "scheduled" ? fromDatetimeLocalValue(startsAtLocal) : "");
    form.set("endsAt", fromDatetimeLocalValue(endsAtLocal));
    submit(form, { method: "post" });
  };

  const fieldError = (field: string) =>
    clientErrors[field as keyof typeof clientErrors] ??
    (actionData && "field" in actionData && actionData.field === field ? actionData.error : undefined);

  const discard = () => {
    if (!offer) return;
    setName(offer.name ?? "");
    setTargetType(offer.targetType ?? "products");
    setTargetResources(offer.targetResources ?? []);
    setTiers(offer.tiers ?? DEFAULT_TIERS);
    setAccent(offer.accent ?? "#FF4A1C");
    setCombineProduct(offer.combineProduct ?? false);
    setCombineOrder(offer.combineOrder ?? false);
    setScheduleMode(offer.startsAt ? "scheduled" : "immediate");
    setStartsAtLocal(toDatetimeLocalValue(offer.startsAt ?? null));
    setEndsAtLocal(toDatetimeLocalValue(offer.endsAt ?? null));
  };

  return (
    <Page
      title={offer.id === "new" ? "New offer" : name}
      backAction={{ onAction: () => navigate("/app/offers") }}
      titleMetadata={
        <InlineStack gap="200" blockAlign="center">
          <StatusPill status={offer.displayStatus} />
          {isDirty ? <Badge tone="attention">Unsaved changes</Badge> : null}
        </InlineStack>
      }
      primaryAction={{ content: "Publish", loading: busy, disabled: hasBlockingErrors, onAction: () => save("publish") }}
      secondaryActions={[{ content: "Save draft", disabled: hasBlockingErrors, onAction: () => save("save") }]}
    >
      {isDirty ? (
        <ContextualSaveBar
          message="Unsaved changes"
          saveAction={{ content: "Save draft", loading: busy, disabled: hasBlockingErrors, onAction: () => save("save") }}
          discardAction={{ content: "Discard", onAction: discard }}
        />
      ) : null}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {offer.resourceLoadError ? <ProductAccessBanner shopDomain={shopDomain} /> : null}
            {actionData && "error" in actionData && actionData.error ? (
              <Banner tone="critical" title="This offer was not published">
                <p>{actionData.error}</p>
              </Banner>
            ) : null}
            {actionData && "ok" in actionData ? (
              <Banner tone="success" title="Saved">
                <p>
                  Add two units to a cart on a targeted product and confirm the
                  checkout total matches the widget.
                </p>
              </Banner>
            ) : null}
            {actionData && "ok" in actionData && actionData.note ? (
              <Banner tone="warning" title="Offer conflict">
                <p>{actionData.note}</p>
              </Banner>
            ) : null}

            <Panel>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Offer details</Text>
                <TextField
                  label="Name"
                  helpText="Shoppers see this in the cart next to the discount."
                  value={name}
                  onChange={setName}
                  autoComplete="off"
                />
              </BlockStack>
            </Panel>

            <Panel>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Where should this offer apply?</Text>
                <Select
                  label="Applies to"
                  labelHidden
                  options={[
                    { label: "Specific products", value: "products" },
                    { label: "A collection", value: "collection" },
                    { label: "Every product in the store", value: "all" },
                  ]}
                  value={targetType}
                  onChange={changeTargetType}
                />
                {targetType !== "all" ? (
                  <ResourcePickerField
                    type={targetType === "collection" ? "collection" : "product"}
                    label={targetType === "collection" ? "Collections" : "Products"}
                    buttonLabel={targetType === "collection" ? "Select collections" : "Select products"}
                    selected={targetResources}
                    onChange={setTargetResources}
                    error={fieldError("targetIds")}
                  />
                ) : null}
              </BlockStack>
            </Panel>

            <Panel>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Quantity discounts</Text>
                </InlineStack>

                <BlockStack gap="300">
                  {tiers.map((tier, index) => (
                    <Box
                      key={index}
                      padding="300"
                      borderWidth="025"
                      borderColor="border"
                      borderRadius="200"
                    >
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center" wrap={false}>
                          <InlineStack gap="150" blockAlign="center" wrap={false}>
                            <Text as="span" variant="bodyMd">Buy</Text>
                            <Box width="70px">
                              <TextField
                                label="Quantity"
                                labelHidden
                                type="number"
                                min={2}
                                value={String(tier.quantity)}
                                onChange={(value) => update(index, { quantity: Number(value) })}
                                autoComplete="off"
                              />
                            </Box>
                            <Text as="span" variant="bodyMd">or more</Text>
                          </InlineStack>
                          <Button variant="plain" tone="critical" onClick={() => setTiers((current) => current.filter((_, i) => i !== index))}>
                            Remove
                          </Button>
                        </InlineStack>

                        <InlineStack gap="150" blockAlign="center" wrap={false}>
                          <Text as="span" variant="bodyMd">
                            {tier.type === "fixed_price" ? "Set total price at" : "Give"}
                          </Text>
                          <Box width="90px">
                            <TextField
                              label="Value"
                              labelHidden
                              type="number"
                              value={String(tier.type === "percentage" ? tier.value : tier.value / 100)}
                              onChange={(value) =>
                                update(index, {
                                  value: tier.type === "percentage" ? Number(value) : Math.round(Number(value) * 100),
                                })
                              }
                              autoComplete="off"
                            />
                          </Box>
                          <Box width="140px">
                            <Select
                              label="Discount type"
                              labelHidden
                              options={[
                                { label: "% off", value: "percentage" },
                                { label: "off", value: "amount" },
                                { label: "flat price", value: "fixed_price" },
                              ]}
                              value={tier.type}
                              onChange={(value) => update(index, { type: value as DiscountType })}
                            />
                          </Box>
                        </InlineStack>

                        <Checkbox
                          label="Highlight as Most Popular"
                          checked={Boolean(tier.badge)}
                          onChange={(checked) =>
                            setTiers((current) => current.map((item, i) => ({ ...item, badge: checked && i === index })))
                          }
                        />
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>

                <InlineStack>
                  <Button
                    onClick={() =>
                      setTiers((current) => [
                        ...current,
                        { quantity: (current.at(-1)?.quantity ?? 1) + 1, type: "percentage", value: 20 },
                      ])
                    }
                  >
                    + Add tier
                  </Button>
                </InlineStack>
                {fieldError("tiers") ? (
                  <Text as="p" tone="critical" variant="bodySm">
                    {fieldError("tiers")}
                  </Text>
                ) : null}
              </BlockStack>
            </Panel>

            <Panel>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Other discounts</Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Off by default. If a shopper has a code and a bundle, only the
                  bundle applies unless you allow stacking here.
                </Text>
                <Checkbox
                  label="Allow product discount codes to stack on top"
                  checked={combineProduct}
                  onChange={setCombineProduct}
                />
                <Checkbox
                  label="Allow order discount codes to stack on top"
                  checked={combineOrder}
                  onChange={setCombineOrder}
                />
              </BlockStack>
            </Panel>

            <Panel>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Schedule</Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Optional — leave this as-is to publish right away.
                </Text>
                <BlockStack gap="200">
                  <RadioButton
                    label="Start immediately"
                    checked={scheduleMode === "immediate"}
                    onChange={() => setScheduleMode("immediate")}
                  />
                  <RadioButton
                    label="Start on a schedule"
                    checked={scheduleMode === "scheduled"}
                    onChange={() => setScheduleMode("scheduled")}
                  />
                </BlockStack>
                {scheduleMode === "scheduled" ? (
                  <InlineStack gap="300" wrap>
                    <Box minWidth="220px">
                      <TextField
                        label="Start date & time"
                        type="datetime-local"
                        value={startsAtLocal}
                        onChange={setStartsAtLocal}
                        autoComplete="off"
                        error={fieldError("schedule")}
                      />
                    </Box>
                    <Box minWidth="220px">
                      <TextField
                        label="End date & time (optional)"
                        type="datetime-local"
                        value={endsAtLocal}
                        onChange={setEndsAtLocal}
                        autoComplete="off"
                      />
                    </Box>
                  </InlineStack>
                ) : null}
              </BlockStack>
            </Panel>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <div style={{ position: "sticky", top: 20 }}>
            <BlockStack gap="400">
              <Panel>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Live preview</Text>
                    <ButtonGroup variant="segmented">
                      <Button pressed={previewMode === "desktop"} onClick={() => setPreviewMode("desktop")}>
                        Desktop
                      </Button>
                      <Button pressed={previewMode === "mobile"} onClick={() => setPreviewMode("mobile")}>
                        Mobile
                      </Button>
                    </ButtonGroup>
                  </InlineStack>
                  <Text as="p" tone="subdued" variant="bodySm">
                    This is the same math the storefront and the checkout use.
                  </Text>
                  <div
                    style={{
                      margin: previewMode === "mobile" ? "0 auto" : undefined,
                      maxWidth: previewMode === "mobile" ? 300 : "100%",
                      border: previewMode === "mobile" ? "1px solid rgba(0,0,0,0.1)" : "none",
                      borderRadius: previewMode === "mobile" ? 16 : 0,
                      padding: previewMode === "mobile" ? 12 : 0,
                      background: previewMode === "mobile" ? "#FAF9F6" : "transparent",
                    }}
                  >
                    <OfferPreview
                      unitPriceCents={previewUnitPrice}
                      tiers={tiers}
                      accent={accent}
                      badgeText={badgeText}
                      savingsDisplay={previewDesign.savingsDisplay}
                      cardStyle={previewDesign.cardStyle}
                    />
                  </div>
                  <TextField
                    label="Accent colour"
                    value={accent}
                    onChange={setAccent}
                    autoComplete="off"
                    helpText="Everything else is inherited from your theme."
                  />
                </BlockStack>
              </Panel>

              <Panel>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Place in theme</Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    The widget only appears once the block is on your product
                    template. You place it once, for all products.
                  </Text>
                  <Button
                    url={themeEditorDeepLink(shopDomain)}
                    target="_blank"
                  >
                    Open the theme editor
                  </Button>
                </BlockStack>
              </Panel>
            </BlockStack>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <Page title="Offer">
        <Layout>
          <Layout.Section>
            <Panel>
              <EmptyState
                heading="This offer no longer exists"
                action={{ content: "Back to offers", url: "/app/offers" }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>It may have been deleted, or the link is out of date.</p>
              </EmptyState>
            </Panel>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
  // Anything else (auth/session errors, unexpected failures) is handled by
  // the app-level boundary, which knows how to deal with reauthentication.
  throw error;
}
