import { redirect, type LoaderFunctionArgs } from "react-router";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};

export default function Index() {
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 480, margin: "80px auto", padding: 24 }}>
      <h1>BundleKit</h1>
      <p>Product-page bundles and quantity breaks for Shopify.</p>
      <form method="post" action="/auth/login">
        <label>
          Shop domain
          <input type="text" name="shop" placeholder="my-shop.myshopify.com" />
        </label>
        <button type="submit">Log in</button>
      </form>
    </main>
  );
}
