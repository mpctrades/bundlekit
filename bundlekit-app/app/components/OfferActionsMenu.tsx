import { useState } from "react";
import { ActionList, Button, Modal, Popover, Text } from "@shopify/polaris";
import { MenuHorizontalIcon } from "@shopify/polaris-icons";
import { useFetcher } from "react-router";

export interface OfferActionsMenuProps {
  offerId: string;
  offerName: string;
  status: "draft" | "scheduled" | "live" | "paused";
  onEdit: () => void;
}

/** Row-level lifecycle actions (Edit / Duplicate / Pause-Resume / Delete).
 *  Submits to the current route's action via a fetcher so the offers list
 *  never does a full-page navigation for these. */
export function OfferActionsMenu({ offerId, offerName, status, onEdit }: OfferActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";

  const submit = (intent: string) => fetcher.submit({ intent, offerId }, { method: "post" });

  const items = [
    { content: "Edit", onAction: () => { setOpen(false); onEdit(); } },
    {
      content: "Duplicate",
      onAction: () => {
        setOpen(false);
        submit("duplicate");
      },
    },
    status === "paused"
      ? {
          content: "Resume",
          onAction: () => {
            setOpen(false);
            submit("resume");
          },
        }
      : {
          content: "Pause",
          disabled: status === "draft" || status === "scheduled",
          onAction: () => {
            setOpen(false);
            submit("pause");
          },
        },
    {
      content: "Delete",
      destructive: true,
      onAction: () => {
        setOpen(false);
        setConfirmingDelete(true);
      },
    },
  ];

  const error = fetcher.data && "error" in fetcher.data ? fetcher.data.error : undefined;

  return (
    <>
      <div onClick={(event) => event.stopPropagation()} style={{ position: "relative" }}>
        <Popover
          active={open}
          onClose={() => setOpen(false)}
          activator={
            <Button
              icon={MenuHorizontalIcon}
              variant="tertiary"
              accessibilityLabel="Offer actions"
              disabled={busy}
              onClick={() => setOpen((value) => !value)}
            />
          }
        >
          <ActionList items={items} />
        </Popover>
        {error ? (
          <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 1, width: 240, marginTop: 4 }}>
            <div style={{ background: "#FFF4F4", border: "1px solid #FED3D1", borderRadius: 8, padding: "8px 10px" }}>
              <Text as="p" tone="critical" variant="bodySm">
                {error}
              </Text>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete this offer?"
        primaryAction={{
          content: "Delete offer",
          destructive: true,
          onAction: () => {
            setConfirmingDelete(false);
            submit("delete");
          },
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => setConfirmingDelete(false) }]}
      >
        <Modal.Section>
          <div onClick={(event) => event.stopPropagation()}>
            <Text as="p">
              {`"${offerName}" and its discount will be removed from your store. Shoppers will no longer see this offer, and this can't be undone.`}
            </Text>
          </div>
        </Modal.Section>
      </Modal>
    </>
  );
}
