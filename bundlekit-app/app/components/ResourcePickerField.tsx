import { useAppBridge } from "@shopify/app-bridge-react";
import { BlockStack, InlineStack, Text } from "@shopify/polaris";

export interface PickedResource {
  id: string;
  title: string;
  image: string | null;
  subtitle?: string;
}

export interface ResourcePickerFieldProps {
  type: "product" | "collection";
  label: string;
  buttonLabel: string;
  selected: PickedResource[];
  onChange: (selected: PickedResource[]) => void;
  error?: string;
}

/** Merchant-facing swap-in for pasting `gid://shopify/...` by hand (F4). Opens
 *  Shopify's own resource picker via App Bridge so a merchant only ever sees
 *  product/collection names as removable chips, never an id. */
export function ResourcePickerField({ type, label, buttonLabel, selected, onChange, error }: ResourcePickerFieldProps) {
  const shopify = useAppBridge();

  const openPicker = async () => {
    const result = await shopify.resourcePicker({
      type,
      action: "select",
      multiple: true,
      selectionIds: selected.map((item) => ({ id: item.id })),
    });
    if (!result) return; // merchant cancelled

    onChange(
      result.map((item) => {
        if (type === "product") {
          const product = item as unknown as { id: string; title: string; images?: Array<{ originalSrc: string }>; variants?: unknown[] };
          const variantCount = product.variants?.length ?? 0;
          return {
            id: product.id,
            title: product.title,
            image: product.images?.[0]?.originalSrc ?? null,
            subtitle: variantCount > 1 ? `${variantCount} variants` : undefined,
          };
        }
        const collection = item as unknown as { id: string; title: string; image?: { originalSrc: string } | null };
        return { id: collection.id, title: collection.title, image: collection.image?.originalSrc ?? null };
      }),
    );
  };

  const remove = (id: string) => onChange(selected.filter((item) => item.id !== id));

  return (
    <BlockStack gap="150">
      <Text as="span" variant="bodyMd" fontWeight="medium">
        {label}
      </Text>
      <InlineStack gap="150" blockAlign="center">
        {selected.map((item) => (
          <span
            key={item.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(0,0,0,0.06)",
              borderRadius: 999,
              padding: "5px 6px 5px 12px",
              maxWidth: 220,
            }}
            title={item.subtitle ? `${item.title} · ${item.subtitle}` : item.title}
          >
            <Text as="span" variant="bodySm" fontWeight="medium" truncate>
              {item.title}
            </Text>
            <button
              type="button"
              onClick={() => remove(item.id)}
              aria-label={`Remove ${item.title}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                minWidth: 18,
                border: "none",
                borderRadius: "50%",
                background: "rgba(0,0,0,0.08)",
                color: "rgba(0,0,0,0.65)",
                cursor: "pointer",
                fontSize: 13,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={openPicker}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "1.5px dashed rgba(0,0,0,0.22)",
            borderRadius: 999,
            padding: "6px 14px",
            color: "rgba(0,0,0,0.7)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          + {buttonLabel}
        </button>
      </InlineStack>
      {error ? (
        <Text as="p" tone="critical" variant="bodySm">
          {error}
        </Text>
      ) : null}
    </BlockStack>
  );
}
