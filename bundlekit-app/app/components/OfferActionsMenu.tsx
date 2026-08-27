import { useEffect, useRef, useState } from "react";
import { ActionList, Button, Modal, Popover, Text } from "@shopify/polaris";
import { MenuHorizontalIcon } from "@shopify/polaris-icons";
import { useFetcher } from "react-router";
import { useToast } from "./ToastProvider";

export interface OfferActionsMenuProps {
  offerId: string;
  offerName: string;
  status: "draft" | "scheduled" | "live" | "paused";
  onEdit: () => void;
}

const INTENT_SUCCESS_MESSAGE: Record<string, string> = {
  duplicate: "Offer duplicated",
  pause: "Offer paused — the discount is off for shoppers",
  resume: "Offer resumed — the discount is live again",
  delete: "Offer deleted",
};

/** Row-level lifecycle actions (Edit / Duplicate / Pause-Resume / Delete).
 *  Submits to the current route's action via a fetcher so the offers list
 *  never does a full-page navigation for these. */
export function OfferActionsMenu({ offerId, offerName, status, onEdit }: OfferActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const { showToast } = useToast();
  const lastIntent = useRef<string | null>(null);
  const previousState = useRef(fetcher.state);

  const submit = (intent: string) => {
    lastIntent.current = intent;
    fetcher.submit({ intent, offerId }, { method: "post" });
  };

  // Fires once per completed submission (idle -> submitting -> idle), not on
  // every render — a merchant needs to see the result even for a click that
  // happens off-screen (e.g. from the popover, which closes immediately).
  useEffect(() => {
    if (previousState.current !== "idle" && fetcher.state === "idle" && fetcher.data) {
      if ("error" in fetcher.data && fetcher.data.error) {
        showToast(fetcher.data.error, true);
      } else if (lastIntent.current) {
        showToast(INTENT_SUCCESS_MESSAGE[lastIntent.current] ?? "Done");
      }
    }
    previousState.current = fetcher.state;
  }, [fetcher.state, fetcher.data, showToast]);

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

  const isLive = status === "live";

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
      </div>

      {isLive ? (
        <Modal
          open={confirmingDelete}
          onClose={() => setConfirmingDelete(false)}
          title="Pause this offer before deleting it"
          primaryAction={{
            content: "Pause offer",
            onAction: () => {
              setConfirmingDelete(false);
              submit("pause");
            },
          }}
          secondaryActions={[{ content: "Cancel", onAction: () => setConfirmingDelete(false) }]}
        >
          <Modal.Section>
            <div onClick={(event) => event.stopPropagation()}>
              <Text as="p">
                {`"${offerName}" is live — shoppers can see and use it right now. Pause it first so the discount stops cleanly, then you can delete it.`}
              </Text>
            </div>
          </Modal.Section>
        </Modal>
      ) : (
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
                {`"${offerName}" and its performance history (views, orders, revenue) will be permanently removed. This can't be undone.`}
              </Text>
            </div>
          </Modal.Section>
        </Modal>
      )}
    </>
  );
}
