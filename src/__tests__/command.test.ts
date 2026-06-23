import { describe, it, expect } from "vitest";
import { createAuth } from "../core/createAuth";
import { mockDriver } from "../drivers/mockDriver";
import { authCommand, createLoginCommand, createLogoutCommand, authHeaders } from "../command";

describe("command integration", () => {
  it("authCommand injects the current token into context", async () => {
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1" }, token: "abc" }),
      toUser: (s) => s.user as { id: string },
      getToken: (s) => s.token as string,
    });

    const auth = createAuth({ driver });
    await auth.login({});

    let capturedToken: string | null = null;
    const cmd = authCommand(auth, "test/cmd", async (_vars, ctx) => {
      capturedToken = ctx.token;
      return "ok";
    });

    await cmd.executeAsync({});

    expect(capturedToken).toBe("abc");
  });

  it("authHeaders returns the current token", async () => {
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1" }, token: "abc" }),
      toUser: (s) => s.user as { id: string },
      getToken: (s) => s.token as string,
    });

    const auth = createAuth({ driver });
    await auth.login({});

    expect(authHeaders(auth)).toEqual({ Authorization: "Bearer abc" });
  });

  it("createLoginCommand logs in via createCommand", async () => {
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1" } }),
      toUser: (s) => s.user as { id: string },
    });

    const auth = createAuth({ driver });
    const cmd = createLoginCommand(auth, "auth/login");

    const user = await cmd.executeAsync({});

    expect(auth.isAuthenticated.value).toBe(true);
    expect(user).toEqual({ id: "1" });
  });

  it("createLogoutCommand logs out via createCommand", async () => {
    const driver = mockDriver({
      login: () => Promise.resolve({ user: { id: "1" } }),
      logout: () => Promise.resolve(),
      toUser: (s) => s.user as { id: string },
    });

    const auth = createAuth({ driver });
    await auth.login({});

    const cmd = createLogoutCommand(auth, "auth/logout");
    await cmd.executeAsync();

    expect(auth.isAuthenticated.value).toBe(false);
  });
});
