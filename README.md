# @deijose/nix-js-auth

[![npm version](https://img.shields.io/npm/v/@deijose/nix-js-auth.svg)](https://www.npmjs.com/package/@deijose/nix-js-auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Authentication and authorization library for [Nix.js](https://nix-js.dev) built entirely on reactive signals.

**Agnostic by design.** Bring your own driver, your own user model, and your own authorization rules. The library only orchestrates state and exposes it as signals that the router, templates, and components can read reactively.

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Core concepts](#core-concepts)
- [Quick start](#quick-start)
- [Core API](#core-api)
- [Drivers](#drivers)
- [Providers](#providers)
- [Storage adapters](#storage-adapters)
- [Policy engine](#policy-engine)
- [Router integration](#router-integration)
- [Optional provide/inject](#optional-provideinject)
- [Multi-provider](#multi-provider)
- [Testing](#testing)
- [Best practices](#best-practices)
- [TypeScript](#typescript)
- [FAQ](#faq)
- [License](#license)

## Features

- **Signal-based state**: `auth.user`, `auth.isAuthenticated`, `auth.can(...)` are reactive signals.
- **Driver-based core**: connect JWT, session cookies, API keys, or any custom backend.
- **Custom user model**: no forced `roles` or `permissions` fields; use identity mapping or custom policies.
- **Policy engine**: compose authorization rules with `createPolicy`, `rbacPolicy`, and helpers.
- **Router integration**: declarative `meta.auth` DSL and standalone guards.
- **Optional `provide/inject`**: use `auth` directly or inject it via `useAuth()`.
- **Multiple providers**: support email/password, API keys, and other strategies in the same app.
- **Auto-refresh**: automatically refresh tokens before expiry when the driver provides it.
- **TypeScript-first**: full generic support for `Session`, `User`, and `Credentials`.

## Installation

```bash
npm install @deijose/nix-js @deijose/nix-js-auth
```

`@deijose/nix-js` is a peer dependency.

## Core concepts

### Auth instance

An `AuthInstance` is the central object. It holds signals for the current session and user, and exposes methods to log in, log out, refresh, and evaluate policies.

```ts
const auth = createAuth({ driver, storage });
```

### Driver

A driver knows how to talk to your backend. It is the only place where HTTP calls, OAuth redirects, or biometric flows live. The core does not assume any transport.

### Policy

A policy is a pure function that decides whether a user can perform an action. Policies are attached to the auth instance and evaluated by `auth.can()`.

### Router guard

`authRouterPlugin` reads the `meta.auth` field of each route and decides whether to allow navigation, redirect to login, or redirect to an unauthorized page.

## Quick start

```ts
import { createAuth, jwtDriver, localStorageAdapter, createPolicy } from "@deijose/nix-js-auth";

const auth = createAuth({
  driver: jwtDriver({
    loginUrl: "/api/login",
    refreshUrl: "/api/refresh",
  }),
  storage: localStorageAdapter({ key: "app:session" }),
  identity: {
    roles: "roles",
    permissions: "permissions",
  },
});

auth.attachPolicy(
  createPolicy((user, action, context) => {
    if (!user) return false;
    if (action === "post:edit") {
      return user.permissions?.includes("post:edit") || user.id === context.authorId;
    }
    return false;
  }),
);

await auth.login({ email: "deiver@example.com", password: "secret" });

console.log(auth.isAuthenticated.value); // true
console.log(auth.can("post:edit", { authorId: "42" }).value); // true | false
```

## Core API

### `createAuth(options)`

Creates a reactive auth instance.

```ts
interface CreateAuthOptions<Session, User, Credentials> {
  driver?: AuthDriver<Session, User, Credentials>;
  providers?: Record<string, AuthDriver<Session, User, Credentials>>;
  defaultProvider?: string;
  storage?: AuthStorage<Session>;
  autoRefresh?: boolean | { beforeExpirySeconds?: number };
  identity?: AuthIdentity<User>;
  onChange?: (session: Session | null) => void;
  onError?: (error: unknown, event: AuthEvent) => void;
  name?: string;
}
```

### Signals

| Signal | Type | Description |
| --- | --- | --- |
| `auth.session` | `Signal<Session \| null>` | Raw session data returned by the driver. |
| `auth.user` | `Signal<User \| null>` | User object derived from the session via `driver.toUser`. |
| `auth.token` | `Signal<string \| null>` | Token extracted from the session. |
| `auth.isAuthenticated` | `Signal<boolean>` | `true` when `user` is not null. |
| `auth.isAnonymous` | `Signal<boolean>` | `true` when `user` is null. |
| `auth.isReady` | `Signal<boolean>` | `true` after the initial storage hydration completes. |
| `auth.isLoading` | `Signal<boolean>` | `true` during login, logout, or refresh. |
| `auth.error` | `Signal<unknown>` | Last error encountered. |
| `auth.activeProvider` | `Signal<string \| null>` | Current provider name when providers are used. |

### Methods

```ts
// Authentication
await auth.login(credentials);
await auth.logout();
await auth.refresh();
await auth.ready();

// Manual session control
auth.setSession(session);
auth.clearSession();

// Policies
auth.attachPolicy(policy);
auth.detachPolicy(policy);

// Authorization checks
const allowed = auth.can("post:edit", { id: "42" }).value;
const decision = auth.authorize("post:edit", { id: "42" }).value; // { allow, redirect? }

// Identity helpers
auth.hasRole("admin").value;
auth.hasPermission("post:edit").value;
auth.hasScope("read").value;
auth.hasAnyRole(["admin", "editor"]).value;
auth.hasAllPermissions(["post:edit", "post:publish"]).value;
```

### Identity mapping

The `identity` option maps the helpers to your user fields:

```ts
const auth = createAuth({
  driver,
  identity: {
    roles: "myRoles",
    permissions: (user) => user.claims,
    scopes: (user) => user.oauthScopes,
  },
});
```

If no mapping is provided, the helpers fall back to `user.roles`, `user.permissions`, and `user.scopes`.

## Drivers

A driver implements the `AuthDriver` interface:

```ts
interface AuthDriver<Session, User, Credentials> {
  name: string;
  login(credentials: Credentials): Promise<Session>;
  logout(session: Session): Promise<void>;
  hydrate?(raw: unknown): Promise<Session | null>;
  refresh?(session: Session): Promise<Session>;
  getExpiry?(session: Session): number | undefined;
  toUser?(session: Session): User;
  getToken?(session: Session): string | null;
  isValid?(session: Session): boolean;
}
```

### `jwtDriver(options)`

```ts
import { jwtDriver } from "@deijose/nix-js-auth";

const auth = createAuth({
  driver: jwtDriver({
    loginUrl: "/api/login",
    logoutUrl: "/api/logout",
    refreshUrl: "/api/refresh",
    headers: { "x-api-version": "v2" },
  }),
});
```

Expected session shape:

```ts
interface JwtSession<User> {
  user: User;
  token: string;
  refreshToken?: string;
  expiresAt?: number;
}
```

### `mockDriver(options)`

Useful for tests and prototypes.

```ts
import { mockDriver } from "@deijose/nix-js-auth";

const auth = createAuth({
  driver: mockDriver({
    name: "fake",
    login: async (creds) => ({ user: { id: "1", roles: ["admin"] }, token: "abc" }),
    toUser: (session) => session.user,
    getToken: (session) => session.token,
  }),
});
```

### Custom driver

```ts
const legacyDriver = {
  name: "legacy",
  async login(credentials) {
    const res = await fetch("/legacy/auth", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    return res.json();
  },
  async logout(session) {
    await fetch("/legacy/auth", {
      headers: { "X-Legacy-Token": session.token },
    });
  },
  toUser(session) {
    return session.employee;
  },
  getToken(session) {
    return session.token;
  },
  getExpiry(session) {
    return session.expiresAt;
  },
};

const auth = createAuth({ driver: legacyDriver });
```

### Hydration

If a driver implements `hydrate`, it can validate or re-fetch the session when loading from storage:

```ts
const driver = {
  // ...
  async hydrate(raw) {
    const res = await fetch("/api/session/validate", {
      headers: { Authorization: `Bearer ${(raw as any).token}` },
    });
    return res.ok ? (raw as Session) : null;
  },
};
```

## Providers

A provider is a named driver. This is useful when an app supports multiple authentication mechanisms.

```ts
import { credentialsProvider, mockDriver } from "@deijose/nix-js-auth";

const auth = createAuth({
  providers: {
    credentials: credentialsProvider({
      login: async (creds) => {
        const res = await fetch("/api/login", {
          method: "POST",
          body: JSON.stringify(creds),
        });
        return res.json();
      },
    }),
    apiKey: mockDriver({
      name: "apiKey",
      login: async (creds) => ({ user: { id: "2" }, token: creds.key }),
    }),
  },
  defaultProvider: "credentials",
});

await auth.login("credentials", { email, password });
await auth.login("apiKey", { key: "secret" });

console.log(auth.activeProvider.value); // "apiKey"
```

## Storage adapters

Storage adapters are responsible for persisting the session between reloads.

```ts
import { localStorageAdapter, sessionStorageAdapter, memoryAdapter } from "@deijose/nix-js-auth";

const auth = createAuth({
  driver,
  storage: localStorageAdapter({ key: "app:session" }),
});
```

### `localStorageAdapter({ key })`

Persists to `localStorage`. Falls back to in-memory if storage is unavailable.

### `sessionStorageAdapter({ key })`

Persists to `sessionStorage`.

### `memoryAdapter()`

In-memory only. Useful for tests and server-side rendering seeds.

## Policy engine

Policies are pure functions that receive the user, the action, the context, and the session.

```ts
import { createPolicy } from "@deijose/nix-js-auth";

auth.attachPolicy(
  createPolicy((user, action, context, session) => {
    if (!user) return false;

    if (action === "admin:dashboard") {
      return user.isAdmin === true;
    }

    if (action === "post:edit") {
      return user.permissions?.includes("post:edit") || user.id === context.authorId;
    }

    return false;
  }),
);
```

`auth.can(action, context?)` returns a reactive signal that re-evaluates when the user or the attached policies change.

### Policy helpers

```ts
import { hasRole, hasPermission, hasScope, isOwner, all, any, not } from "@deijose/nix-js-auth";

auth.attachPolicy(
  createPolicy((user, action, context) => {
    if (!user) return false;

    if (action === "admin:dashboard") {
      return hasRole("admin")(user, context);
    }

    if (action === "post:edit") {
      return any(
        hasPermission("post:edit"),
        isOwner("post", context.id),
      )(user, context);
    }

    if (action === "post:delete") {
      return all(
        hasRole("admin"),
        not(isOwner("post", context.id)),
      )(user, context);
    }

    return false;
  }),
);
```

### `rbacPolicy`

Convenience policy for role-based and permission-based access control.

```ts
import { rbacPolicy } from "@deijose/nix-js-auth";

auth.attachPolicy(
  rbacPolicy({
    resolveRoles: (user) => user.roles,
    resolvePermissions: (user) => user.permissions,
  }),
);

auth.can("role:admin").value;
auth.can("permission:post:edit").value;
```

## Router integration

```ts
import { createRouter } from "@deijose/nix-js";
import { authRouterPlugin, requireAuth } from "@deijose/nix-js-auth";

const router = createRouter([
  { path: "/login", component: LoginPage, meta: { auth: "public" } },
  { path: "/admin", component: AdminPage, meta: { auth: { can: "admin:dashboard" } } },
  { path: "/post/:id/edit", component: EditPost, meta: { auth: { can: "post:edit" } } },
  { path: "/public", component: PublicPage, meta: { auth: false } },
  { path: "/profile", component: ProfilePage, meta: { auth: "optional" } },
]);

router.beforeEach(
  authRouterPlugin(auth, router, {
    public: ["/login", "/register"],
    defaultRedirect: "/login",
    fallbackRedirect: "/unauthorized",
  }),
);
```

### `meta.auth` DSL

The `meta.auth` field accepts:

- `"public"` or `false` — allow anyone.
- `"optional"` — allow the route, but auth is optional.
- `string` — action passed to `auth.can(action)`.
- `string[]` — any of the actions must be allowed.
- object:
  - `can` — action passed to `auth.can(action, context)`.
  - `context` — static context or a function returning context.
  - `role` — required role.
  - `roles` — any of the roles.
  - `permission` — required permission.
  - `permissions` — all of the permissions.
  - `provider` — required active provider.
  - `redirect` — custom redirect path.
  - `allow` — boolean or a guard function `(to, from, auth) => boolean \| string \| Promise<...>`.
- function — full custom guard `(to, from, auth) => NavigationGuardResult`.

### Dynamic context in routes

```ts
const router = createRouter([
  {
    path: "/post/:id/edit",
    component: EditPost,
    meta: {
      auth: {
        can: "post:edit",
        context: () => ({ id: router.params.value.id }),
      },
    },
  },
]);
```

### Standalone guards

```ts
import { requireAuth, requireRole, requirePermission, requireProvider, requirePolicy } from "@deijose/nix-js-auth";

router.beforeEach(requireAuth(auth, "/login"));
router.beforeEach(requireRole(auth, "admin", "/unauthorized"));
router.beforeEach(requirePermission(auth, "post:edit", "/unauthorized"));
router.beforeEach(requireProvider(auth, "apiKey", "/login"));
router.beforeEach(requirePolicy(auth, (to, from) => auth.can("custom:action", { path: to }).value));
```

### Custom meta interpreter

For advanced use cases, you can replace the default meta interpreter:

```ts
router.beforeEach(
  authRouterPlugin(auth, router, {
    interpretMeta(meta, auth, to, from) {
      if (!meta) return undefined;
      if (meta === "public") return undefined;
      if (typeof meta === "string") {
        return auth.can(meta).value ? undefined : "/unauthorized";
      }
      return undefined;
    },
  }),
);
```

## Optional provide/inject

```ts
import { provide } from "@deijose/nix-js";
import { AuthKey, useAuth } from "@deijose/nix-js-auth";

provide(AuthKey, auth);

// In a descendant component:
const auth = useAuth();
if (auth) {
  console.log(auth.isAuthenticated.value);
}
```

The library is fully usable without `provide/inject` if you prefer to export the instance directly.

## Multi-provider

```ts
import { createAuth, credentialsProvider, mockDriver } from "@deijose/nix-js-auth";

const auth = createAuth({
  providers: {
    credentials: credentialsProvider({
      login: async (creds) => {
        const res = await fetch("/api/login", {
          method: "POST",
          body: JSON.stringify(creds),
        });
        return res.json();
      },
    }),
    apiKey: mockDriver({
      name: "apiKey",
      login: async (creds) => ({ user: { id: "2" }, token: creds.key }),
    }),
  },
  defaultProvider: "credentials",
  storage: localStorageAdapter({ key: "app:session" }),
});

await auth.login("credentials", { email, password });
await auth.login("apiKey", { key: "secret" });

console.log(auth.activeProvider.value); // "apiKey"
```

## Testing

`mockDriver` makes the library easy to test without a real backend.

```ts
import { describe, it, expect } from "vitest";
import { createAuth, mockDriver } from "@deijose/nix-js-auth";

describe("auth", () => {
  it("logs in", async () => {
    const auth = createAuth({
      driver: mockDriver({
        login: () => Promise.resolve({ user: { id: "1", roles: ["admin"] }, token: "abc" }),
        toUser: (s) => s.user,
        getToken: (s) => s.token,
      }),
    });

    await auth.login({ email: "test@example.com", password: "secret" });

    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.user.value).toEqual({ id: "1", roles: ["admin"] });
    expect(auth.token.value).toBe("abc");
  });
});
```

## Best practices

- **Keep the core unopinionated**: do not put backend-specific logic outside the driver.
- **Use `toUser`**: always implement `toUser` if your session object wraps the user.
- **Prefer `can()` in templates**: `auth.can("post:edit").value` is reactive and efficient.
- **Separate policies**: split domain-specific rules into multiple policies instead of one giant function.
- **Custom redirect**: use `redirect` in `meta.auth` or a custom `interpretMeta` for route-specific behavior.
- **Do not store tokens in plain localStorage for production**: use `httpOnly` cookies when possible. Provide a `sessionCookieDriver` or custom driver that reads the cookie.
- **Hydrate safely**: implement `hydrate` in the driver to validate the stored session on startup.

## TypeScript

`createAuth` accepts generics for `Session`, `User`, and `Credentials`:

```ts
interface MySession {
  user: MyUser;
  token: string;
  expiresAt: number;
}

interface MyUser {
  id: string;
  roles: string[];
  permissions: string[];
}

interface MyCredentials {
  email: string;
  password: string;
}

const auth = createAuth<MySession, MyUser, MyCredentials>({
  driver: myDriver,
});
```

The returned `AuthInstance` is typed accordingly.

## FAQ

### Does the library work without a router?

Yes. Use `auth.isAuthenticated` and `auth.can()` directly in your components.

### Can I use multiple auth instances in the same app?

Yes. Each `createAuth` returns an independent instance with its own signals. Future versions will add a formal `createAuthManager` helper.

### What happens if the session expires while the user is using the app?

If the driver implements `refresh` and `getExpiry`, and `autoRefresh` is enabled, the library will refresh the token automatically before expiry.

### How do I handle OAuth / OIDC?

Write a driver that triggers the redirect in `login` and reads the resulting code/token in `hydrate` or after the redirect. A built-in OIDC provider is planned for v0.2.

### How do I integrate with `nix-query`?

You can call `createCommand` from `nix-query` inside your driver's `login` or `refresh` methods. The auth core itself stays dependency-free.

## License

MIT
