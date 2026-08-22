import { BlockStack, Text } from "@shopify/polaris";
import { normaliseTiers, priceTier, type Tier } from "../lib/pricing";

export type SavingsDisplay = "amount" | "percentage" | "both";
export type CardStyle = "outline" | "soft";

export interface OfferPreviewProps {
  unitPriceCents: number;
  tiers: Tier[];
  accent: string;
  badgeText?: string;
  savingsDisplay?: SavingsDisplay;
  cardStyle?: CardStyle;
}

function savingsLabel(savingsCents: number, percentOff: number, mode: SavingsDisplay): string {
  const amount = (savingsCents / 100).toFixed(2);
  if (mode === "amount") return `Save ${amount}`;
  if (mode === "percentage") return `Save ${percentOff}%`;
  return `Save ${amount} (${percentOff}%)`;
}

/** The same math and layout the storefront widget renders — shared by the
 *  offer builder and the Design defaults page so they can never drift. */
export function OfferPreview({
  unitPriceCents,
  tiers,
  accent,
  badgeText = "Most popular",
  savingsDisplay = "both",
  cardStyle = "outline",
}: OfferPreviewProps) {
  return (
    <BlockStack gap="200">
      <PreviewRow label="1 unit" note="Regular price" total={unitPriceCents} selected={false} cardStyle={cardStyle} />
      {normaliseTiers(tiers).map((tier) => {
        const priced = priceTier(unitPriceCents, tier);
        return (
          <PreviewRow
            key={tier.quantity}
            label={`${tier.quantity} units`}
            note={`${(priced.perUnit / 100).toFixed(2)} / unit`}
            total={priced.total}
            savingsText={savingsLabel(priced.savings, priced.percentOff, savingsDisplay)}
            accent={accent}
            selected={Boolean(tier.badge)}
            badgeText={tier.badge ? badgeText : undefined}
            cardStyle={cardStyle}
          />
        );
      })}
    </BlockStack>
  );
}

function PreviewRow({
  label,
  note,
  total,
  savingsText,
  accent,
  selected,
  badgeText,
  cardStyle,
}: {
  label: string;
  note: string;
  total: number;
  savingsText?: string;
  accent?: string;
  selected: boolean;
  badgeText?: string;
  cardStyle: CardStyle;
}) {
  const soft = cardStyle === "soft";
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        border: selected && !soft ? `1.5px solid ${accent}` : "1.5px solid rgba(0,0,0,0.1)",
        background: selected ? (soft ? `${accent}1a` : `${accent}0d`) : "#fff",
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          minWidth: 16,
          borderRadius: "50%",
          border: `1.5px solid ${selected ? accent : "rgba(0,0,0,0.3)"}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} /> : null}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text as="span" variant="bodySm" fontWeight="semibold">
          {label}
        </Text>
        <div>
          <Text as="span" variant="bodySm" tone="subdued">
            {note}
          </Text>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <Text as="span" variant="bodySm" fontWeight="semibold">
          {(total / 100).toFixed(2)}
        </Text>
        {savingsText ? (
          <div>
            <Text as="span" variant="bodySm" tone="success">
              {savingsText}
            </Text>
          </div>
        ) : null}
      </div>
      {badgeText ? (
        <span
          style={{
            position: "absolute",
            top: -8,
            right: 12,
            background: accent,
            color: "#fff",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            padding: "2px 7px",
            borderRadius: 999,
          }}
        >
          {badgeText}
        </span>
      ) : null}
    </div>
  );
}
