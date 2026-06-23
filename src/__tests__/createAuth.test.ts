import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuth } from "../core/createAuth";
import { mockDriver } from "../drivers/mockDriver";
import { memoryAdapter } from "../storage/memoryAdapter";
import { createPolicy } from "../policy/createPolicy";

describe("createAuth", () => {
  beforeEach(() => {
    vi.useFakeTimers?.();
  });

  it("starts with no session and is not authenticated", async () => {
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1" } }),
    });

    const auth = createAuth({ driver });

    expect(auth.session.value).toBeNull();
    expect(auth.user.value).toBeNull();
    expect(auth.isAuthenticated.value).toBe(false);
    expect(auth.isAnonymous.value).toBe(true);
  });

  it("logs in and exposes session, user and token", async () => {
    const driver = mockDriver({
      login: () =>
        Promise.resolve({
          user: { id: "1", roles: ["admin"] },
          token: "abc",
          expiresAt: Date.now() + 60_000,
        }),
      toUser: (s) => s.user as { id: string; roles: string[] },
      getToken: (s) => s.token as string,
      getExpiry: (s) => s.expiresAt as number,
    });

    const auth = createAuth({ driver, autoRefresh: true });

    await auth.login({ email: "test@example.com", password: "123" });

    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.user.value).toEqual({ id: "1", roles: ["admin"] });
    expect(auth.token.value).toBe("abc");
    expect(auth.error.value).toBeNull();
  });

  it("logs out and clears session", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1" }, token: "abc" }),
      logout,
      toUser: (s) => s.user as { id: string },
    });

    const auth = createAuth({ driver });
    await auth.login({ email: "test@example.com", password: "123" });

    await auth.logout();

    expect(logout).toHaveBeenCalledOnce();
    expect(auth.session.value).toBeNull();
    expect(auth.user.value).toBeNull();
    expect(auth.isAuthenticated.value).toBe(false);
  });

  it("persists and hydrates session from storage", async () => {
    const storage = memoryAdapter();
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1" }, token: "abc" }),
      toUser: (s) => s.user as { id: string },
    });

    const auth = createAuth({ driver, storage });
    await auth.login({ email: "test@example.com", password: "123" });

    const auth2 = createAuth({ driver, storage });
    await auth2.ready();

    expect(auth2.isAuthenticated.value).toBe(true);
    expect(auth2.user.value).toEqual({ id: "1" });
  });

  it("evaluates attached policies via can()", async () => {
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1", roles: ["editor"] } }),
      toUser: (s) => s.user as { id: string; roles: string[] },
    });

    const auth = createAuth({ driver });
    auth.attachPolicy(
      createPolicy((user, action) => {
        if (!user) return false;
        if (action === "post:edit") return (user as { roles: string[] }).roles.includes("editor");
        return false;
      }),
    );

    await auth.login({ email: "test@example.com", password: "123" });

    expect(auth.can("post:edit").value).toBe(true);
    expect(auth.can("post:delete").value).toBe(false);
  });

  it("updates can() when policies are attached or detached", async () => {
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1" } }),
      toUser: (s) => s.user as { id: string },
    });

    const auth = createAuth({ driver });
    await auth.login({ email: "test@example.com", password: "123" });

    expect(auth.can("admin").value).toBe(false);

    const dispose = auth.attachPolicy(createPolicy(() => true));
    expect(auth.can("admin").value).toBe(true);

    dispose();
    expect(auth.can("admin").value).toBe(false);
  });

  it("hasRole uses identity mapping", async () => {
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1", myRoles: ["admin"] } }),
      toUser: (s) => s.user as { id: string; myRoles: string[] },
    });

    const auth = createAuth({
      driver,
      identity: { roles: "myRoles" },
    });

    await auth.login({ email: "test@example.com", password: "123" });

    expect(auth.hasRole("admin").value).toBe(true);
    expect(auth.hasRole("user").value).toBe(false);
  });

  it("supports multiple providers and activeProvider", async () => {
    const credentials = mockDriver({
      name: "credentials",
      login: () => Promise.resolve({ user: { id: "1" }, token: "c" }),
      toUser: (s) => s.user as { id: string },
    });
    const apiKey = mockDriver({
      name: "apiKey",
      login: () => Promise.resolve({ user: { id: "2" }, token: "k" }),
      toUser: (s) => s.user as { id: string },
    });

    const auth = createAuth({
      providers: { credentials, apiKey },
      defaultProvider: "credentials",
    });

    expect(auth.activeProvider.value).toBe("credentials");

    await auth.login("apiKey", { key: "secret" });

    expect(auth.activeProvider.value).toBe("apiKey");
    expect(auth.user.value).toEqual({ id: "2" });
  });
});
