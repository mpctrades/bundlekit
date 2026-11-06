/**
 * Moves shops off non-expiring offline access tokens.
 *
 * `future.expiringOfflineAccessTokens` only makes *new* token exchanges
 * expire. A shop that installed before that flag keeps its old permanent
 * token forever, because the template never re-exchanges a session that
 * still works — Shopify admin then shows "Expiring access tokens: Missing"
 * on the app's page, and from January 1, 2027 Shopify delists public apps
 * that still use such tokens (API calls with them fail from April 1, 2027).
 *
 * This exchanges each stored permanent token for an expiring pair (Shopify's
 * "migrate all installations at once" path). The exchange permanently
 * invalidates the old token, so the new session must be stored before
 * anything uses the shop again. A failed or lost response can be retried
 * with the same old token for seven days and returns the same pair.
 * https://shopify.dev/docs/apps/build/authentication-authorization/migrate-to-expiring-offline-access-tokens
 */

export interface MigratableSession {
  id: string;
  shop: string;
  isOnline: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
  expires?: Date | null;
}

export interface MigrationDeps<S> {
  migrate: (args: { shop: string; nonExpiringOfflineAccessToken: string }) => Promise<{ session: S }>;
  store: (session: S) => Promise<boolean>;
}

/** An offline session holding a permanent token: no expiry, no refresh token. */
export function needsMigration(session: MigratableSession | null | undefined): boolean {
  return Boolean(
    session && !session.isOnline && session.accessToken && !session.refreshToken && !session.expires,
  );
}

// One exchange per shop at a time: a merchant opening the app fires several
// requests at once, and the second exchange would present a token the first
// one already invalidated.
const inFlight = new Map<string, Promise<boolean>>();

/** Returns true when the shop now has an expiring token stored. Never throws. */
export function migrateSession<S>(session: MigratableSession, deps: MigrationDeps<S>): Promise<boolean> {
  if (!needsMigration(session)) return Promise.resolve(false);
  const running = inFlight.get(session.shop);
  if (running) return running;

  const job = (async () => {
    try {
      const { session: expiring } = await deps.migrate({
        shop: session.shop,
        nonExpiringOfflineAccessToken: session.accessToken!,
      });
      await deps.store(expiring);
      console.info("[bundlekit] migrated offline token to expiring", { shop: session.shop });
      return true;
    } catch (error) {
      console.warn(
        "[bundlekit] offline token migration failed",
        { shop: session.shop },
        error instanceof Error ? error.message : error,
      );
      return false;
    } finally {
      inFlight.delete(session.shop);
    }
  })();
  inFlight.set(session.shop, job);
  return job;
}

/** Migrates every stored permanent offline token, one shop after another. */
export async function migrateAllSessions<S>(
  sessions: MigratableSession[],
  deps: MigrationDeps<S>,
): Promise<{ migrated: number; failed: number }> {
  let migrated = 0;
  let failed = 0;
  for (const session of sessions.filter(needsMigration)) {
    if (await migrateSession(session, deps)) migrated += 1;
    else failed += 1;
  }
  return { migrated, failed };
}
