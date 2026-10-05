import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session } = await authenticate.webhook(request);
  const current = payload.current as string[];
  if (session) {
    // updateMany: a retry can arrive after uninstall removed the session, and
    // update() would throw (P2025) and answer 500, so Shopify keeps retrying.
    await prisma.session.updateMany({
      where: { id: session.id },
      data: { scope: current.toString() },
    });
  }
  return new Response();
};
