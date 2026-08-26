/** Any admin.graphql/admin.rest call that fails at the HTTP layer (bad or
 *  under-scoped token, Shopify outage, etc.) — when made through
 *  authenticate.admin's context (as opposed to the raw API client) — gets
 *  rethrown by the framework as a plain Response, not the underlying
 *  HttpResponseError, so that's what every route in this app actually sees.
 *  Its body is a raw upstream dump, never fit for a merchant-facing toast. */
export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof Response) {
    return "Couldn't reach Shopify to complete that. If this keeps happening, reinstalling BundleKit from your Shopify admin usually fixes it.";
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Try again, or reinstall BundleKit from your Shopify admin if it keeps happening.";
}
