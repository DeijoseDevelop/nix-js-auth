import { describe, it, expect } from "vitest";
import { createAuth } from "../core/createAuth";
import { mockDriver } from "../drivers/mockDriver";

describe("autoRefresh custom schedule", () => {
  it("uses a custom scheduler", async () => {
    let scheduled = false;
    const scheduler = (_session: unknown, _refresh: () => Promise<void>) => {
      scheduled = true;
      return () => {};
    };

    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1" }, expiresAt: Date.now() + 60_000 }),
      toUser: (s) => s.user as { id: string },
      getExpiry: (s) => (s as { expiresAt: number }).expiresAt,
    });

    const auth = createAuth({
      driver,
      autoRefresh: { schedule: scheduler },
    });

    await auth.login({});

    expect(scheduled).toBe(true);
  });
});
