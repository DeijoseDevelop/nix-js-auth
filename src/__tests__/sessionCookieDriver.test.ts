import { describe, it, expect } from "vitest";
import { createAuth } from "../core/createAuth";
import { sessionCookieDriver } from "../drivers/sessionCookieDriver";
import { memoryAdapter } from "../storage/memoryAdapter";

describe("sessionCookieDriver", () => {
  it("logs in with a mock fetcher and returns the user", async () => {
    const fetcher = async () =>
      new Response(JSON.stringify({ user: { id: "1" } }), { status: 200 });

    const driver = sessionCookieDriver({
      loginUrl: "/api/login",
      sessionUrl: "/api/session",
      fetcher,
    });

    const auth = createAuth({ driver });
    await auth.login({ email: "test@example.com", password: "secret" });

    expect(auth.user.value).toEqual({ id: "1" });
  });

  it("hydrates the session from the sessionUrl", async () => {
    let hydrated = false;
    const fetcher = async (input: RequestInfo) => {
      if (String(input).includes("/api/session")) {
        hydrated = true;
        return new Response(JSON.stringify({ user: { id: "2" } }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    };

    const driver = sessionCookieDriver({
      loginUrl: "/api/login",
      sessionUrl: "/api/session",
      fetcher,
    });

    const auth = createAuth({
      driver,
      storage: memoryAdapter(),
    });

    await auth.ready();

    expect(hydrated).toBe(true);
    expect(auth.user.value).toEqual({ id: "2" });
  });
});
