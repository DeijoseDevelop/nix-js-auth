import { describe, it, expect } from "vitest";
import { createAuth } from "../core/createAuth";
import { apiKeyProvider } from "../providers/apiKeyProvider";

describe("apiKeyProvider", () => {
  it("validates an API key and exposes the user", async () => {
    const provider = apiKeyProvider({
      validate: async (key) => ({ user: { id: "1", key }, token: key }),
      toUser: (s) => s.user as { id: string; key: string },
      getToken: (s) => s.token as string,
    });

    const auth = createAuth({ driver: provider });
    await auth.login({ key: "secret-key" });

    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.user.value).toEqual({ id: "1", key: "secret-key" });
    expect(auth.token.value).toBe("secret-key");
  });
});
