import { describe, it, expect } from "vitest";
import { createAuth } from "../core/createAuth";
import { mockDriver } from "../drivers/mockDriver";

describe("SSR seed", () => {
  it("uses a static seed as initial session", () => {
    const driver = mockDriver({
      toUser: (s) => (s as { user: { id: string } }).user,
    });

    const auth = createAuth({
      driver,
      seed: { user: { id: "seed-user" }, token: "seed-token" },
    });

    expect(auth.user.value).toEqual({ id: "seed-user" });
    expect(auth.token.value).toBe("seed-token");
    expect(auth.isAuthenticated.value).toBe(true);
  });

  it("uses a seed function as initial session", () => {
    const driver = mockDriver({
      toUser: (s) => (s as { user: { id: string } }).user,
    });

    const auth = createAuth({
      driver,
      seed: () => ({ user: { id: "seed-user" }, token: "seed-token" }),
    });

    expect(auth.user.value).toEqual({ id: "seed-user" });
    expect(auth.isAuthenticated.value).toBe(true);
  });
});
