import { describe, it, expect } from "vitest";
import { createAuthManager } from "../core/authManager";
import { mockDriver } from "../drivers/mockDriver";

describe("createAuthManager", () => {
  it("creates and retrieves named instances", () => {
    const manager = createAuthManager();
    const auth = manager.create("app", {
      driver: mockDriver({
        login: () => Promise.resolve({ user: { id: "1" } }),
        toUser: (s) => s.user as { id: string },
      }),
    });

    expect(manager.has("app")).toBe(true);
    expect(manager.get("app")).toBe(auth);
    expect(manager.list()).toEqual(["app"]);
  });

  it("throws when creating a duplicate instance", () => {
    const manager = createAuthManager();
    manager.create("app", {
      driver: mockDriver({
        login: () => Promise.resolve({ user: { id: "1" } }),
        toUser: (s) => s.user as { id: string },
      }),
    });

    expect(() =>
      manager.create("app", {
        driver: mockDriver({
          login: () => Promise.resolve({ user: { id: "2" } }),
          toUser: (s) => s.user as { id: string },
        }),
      }),
    ).toThrow("already exists");
  });

  it("removes and clears instances", () => {
    const manager = createAuthManager();
    manager.create("a", {
      driver: mockDriver({
        login: () => Promise.resolve({ user: { id: "1" } }),
        toUser: (s) => s.user as { id: string },
      }),
    });
    manager.create("b", {
      driver: mockDriver({
        login: () => Promise.resolve({ user: { id: "2" } }),
        toUser: (s) => s.user as { id: string },
      }),
    });

    manager.remove("a");
    expect(manager.has("a")).toBe(false);
    expect(manager.list()).toEqual(["b"]);

    manager.clear();
    expect(manager.list()).toEqual([]);
  });
});
