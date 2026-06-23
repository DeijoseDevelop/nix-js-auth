import { describe, it, expect } from "vitest";
import { oidcProvider } from "../providers/oidcProvider";

function base64Url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = base64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  return `${header}.${body}.`;
}

describe("oidcProvider", () => {
  const metadata = {
    authorization_endpoint: "https://idp.example.com/auth",
    token_endpoint: "https://idp.example.com/token",
    userinfo_endpoint: "https://idp.example.com/userinfo",
    end_session_endpoint: "https://idp.example.com/logout",
  };

  function createMockFetcher() {
    return async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/.well-known/openid-configuration")) {
        return new Response(JSON.stringify(metadata), { status: 200 });
      }
      if (url === metadata.token_endpoint) {
        const body = new URLSearchParams(init?.body as string);
        const code = body.get("code") ?? "default";
        return new Response(
          JSON.stringify({
            access_token: "access-" + code,
            id_token: makeJwt({ sub: "user-" + code }),
            refresh_token: "refresh-" + code,
            expires_in: 3600,
          }),
          { status: 200 },
        );
      }
      if (url === metadata.userinfo_endpoint) {
        return new Response(JSON.stringify({ sub: "user-1", name: "Test" }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    };
  }

  it("builds a login URL with PKCE parameters", async () => {
    const provider = oidcProvider({
      authority: "https://idp.example.com",
      clientId: "client-1",
      redirectUri: "https://app.example.com/callback",
      fetcher: createMockFetcher(),
    });

    const login = await provider.buildLoginUrl();

    const url = new URL(login.url);
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("code_challenge")).toBe(true);
    expect(url.searchParams.has("state")).toBe(true);
    expect(url.searchParams.has("nonce")).toBe(true);
    expect(login.codeVerifier.length).toBeGreaterThan(0);
  });

  it("exchanges the code for a session", async () => {
    const provider = oidcProvider<{ sub: string; name: string }>({
      authority: "https://idp.example.com",
      clientId: "client-1",
      redirectUri: "https://app.example.com/callback",
      fetcher: createMockFetcher(),
    });

    const session = await provider.login({
      code: "abc",
      codeVerifier: "verifier",
    });

    expect(session.accessToken).toBe("access-abc");
    expect(session.idToken).toContain("eyJhbGciOiJub25l");
    expect(session.refreshToken).toBe("refresh-abc");
    expect(session.user).toEqual({ sub: "user-1", name: "Test" });
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it("builds a logout URL", async () => {
    const provider = oidcProvider({
      authority: "https://idp.example.com",
      clientId: "client-1",
      redirectUri: "https://app.example.com/callback",
      postLogoutRedirectUri: "https://app.example.com",
      fetcher: createMockFetcher(),
    });

    const url = await provider.buildLogoutUrl("id-token");

    expect(url).toContain("https://idp.example.com/logout");
    expect(url).toContain("id_token_hint=id-token");
    expect(url).toContain("post_logout_redirect_uri=https%3A%2F%2Fapp.example.com");
  });
});
