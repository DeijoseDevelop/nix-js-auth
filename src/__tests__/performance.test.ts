import { describe, it, expect, vi } from "vitest";
import { createAuth } from "../core/createAuth";
import { mockDriver } from "../drivers/mockDriver";
import type { AuthStorage } from "../core/types";

describe("performance: auto-refresh scheduling", () => {
  it("schedules the refresh only once per session change (H1)", async () => {
    const schedule = vi.fn(() => () => {});
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1" }, expiresAt: Date.now() + 60_000 }),
      toUser: (s) => s.user as { id: string },
      getExpiry: (s) => (s as { expiresAt: number }).expiresAt,
    });

    const auth = createAuth({ driver, autoRefresh: { schedule } });
    await auth.login({});

    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it("dispose() clears the pending refresh timer (H1)", async () => {
    const cleanup = vi.fn();
    const schedule = vi.fn(() => cleanup);
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1" }, expiresAt: Date.now() + 60_000 }),
      toUser: (s) => s.user as { id: string },
      getExpiry: (s) => (s as { expiresAt: number }).expiresAt,
    });

    const auth = createAuth({ driver, autoRefresh: { schedule } });
    await auth.login({});

    auth.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe("performance: ready() hydration memoization (M1)", () => {
  it("reads from storage only once for concurrent ready() calls", async () => {
    let getCalls = 0;
    const stored = { user: { id: "1" } };
    const storage: AuthStorage<{ user: { id: string } }> = {
      get() {
        getCalls++;
        return new Promise((resolve) => setTimeout(() => resolve(stored), 5));
      },
      set() {},
      remove() {},
    };

    const driver = mockDriver({
      login: () => Promise.resolve(stored),
      toUser: (s) => (s as typeof stored).user,
    });

    const auth = createAuth({ driver, storage });

    await Promise.all([auth.ready(), auth.ready(), auth.ready()]);

    // One call from the internal void ready() bootstrap; concurrent explicit
    // calls must reuse the in-flight promise instead of re-reading storage.
    expect(getCalls).toBe(1);
    expect(auth.isAuthenticated.value).toBe(true);
  });
});

describe("performance: non-reactive check helpers (H2/M2)", () => {
  it("checkRole / checkPermission / checkScope return booleans without signals", async () => {
    const driver = mockDriver({
      login: () =>
        Promise.resolve({
          user: { id: "1", roles: ["admin"], permissions: ["post:edit"], scopes: ["read"] },
        }),
      toUser: (s) => s.user as Record<string, unknown>,
    });

    const auth = createAuth({
      driver,
      identity: { roles: "roles", permissions: "permissions", scopes: "scopes" },
    });
    await auth.login({});

    expect(auth.checkRole("admin")).toBe(true);
    expect(auth.checkRole("user")).toBe(false);
    expect(auth.checkPermission("post:edit")).toBe(true);
    expect(auth.checkPermission("post:delete")).toBe(false);
    expect(auth.checkScope("read")).toBe(true);
    expect(auth.checkAnyRole(["user", "admin"])).toBe(true);
    expect(auth.checkAnyRole(["user", "guest"])).toBe(false);
    expect(auth.checkAllPermissions(["post:edit"])).toBe(true);
    expect(auth.checkAllPermissions(["post:edit", "post:delete"])).toBe(false);
  });

  it("check helpers agree with their reactive counterparts", async () => {
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1", roles: ["editor"] } }),
      toUser: (s) => s.user as Record<string, unknown>,
    });
    const auth = createAuth({ driver, identity: { roles: "roles" } });
    await auth.login({});

    expect(auth.checkRole("editor")).toBe(auth.hasRole("editor").value);
    expect(auth.checkRole("admin")).toBe(auth.hasRole("admin").value);
  });
});
