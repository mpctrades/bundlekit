import { describe, expect, it, vi } from "vitest";
import { migrateAllSessions, migrateSession, needsMigration } from "./token-migration.server";

const permanent = { id: "offline_a.myshopify.com", shop: "a.myshopify.com", isOnline: false, accessToken: "shpat_old" };

describe("needsMigration", () => {
  it("flags offline sessions with a permanent token", () => {
    expect(needsMigration(permanent)).toBe(true);
  });
  it("skips sessions that already expire, online sessions and empty ones", () => {
    expect(needsMigration({ ...permanent, refreshToken: "r", expires: new Date() })).toBe(false);
    expect(needsMigration({ ...permanent, expires: new Date() })).toBe(false);
    expect(needsMigration({ ...permanent, isOnline: true })).toBe(false);
    expect(needsMigration({ ...permanent, accessToken: "" })).toBe(false);
    expect(needsMigration(null)).toBe(false);
  });
});

describe("migrateSession", () => {
  it("exchanges the old token and stores the new session", async () => {
    const migrate = vi.fn().mockResolvedValue({ session: { id: "offline_a.myshopify.com", refreshToken: "r" } });
    const store = vi.fn().mockResolvedValue(true);
    expect(await migrateSession(permanent, { migrate, store })).toBe(true);
    expect(migrate).toHaveBeenCalledWith({ shop: "a.myshopify.com", nonExpiringOfflineAccessToken: "shpat_old" });
    expect(store).toHaveBeenCalledWith({ id: "offline_a.myshopify.com", refreshToken: "r" });
  });

  it("runs one exchange per shop even when requests overlap", async () => {
    let release!: () => void;
    const migrate = vi.fn(
      () => new Promise<{ session: object }>((resolve) => (release = () => resolve({ session: {} }))),
    );
    const store = vi.fn().mockResolvedValue(true);
    const first = migrateSession(permanent, { migrate, store });
    const second = migrateSession(permanent, { migrate, store });
    release();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(migrate).toHaveBeenCalledTimes(1);
  });

  it("never throws: a rejected exchange keeps the old session", async () => {
    const migrate = vi.fn().mockRejectedValue(new Error("invalid_subject_token"));
    const store = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await migrateSession(permanent, { migrate, store })).toBe(false);
    expect(store).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("migrateAllSessions", () => {
  it("only touches permanent tokens and counts results", async () => {
    const migrate = vi
      .fn()
      .mockResolvedValueOnce({ session: {} })
      .mockRejectedValueOnce(new Error("gone"));
    const store = vi.fn().mockResolvedValue(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await migrateAllSessions(
      [
        permanent,
        { ...permanent, id: "offline_b", shop: "b.myshopify.com" },
        { ...permanent, id: "offline_c", shop: "c.myshopify.com", refreshToken: "r", expires: new Date() },
      ],
      { migrate, store },
    );
    expect(result).toEqual({ migrated: 1, failed: 1 });
    expect(migrate).toHaveBeenCalledTimes(2);
    warn.mockRestore();
    info.mockRestore();
  });
});
