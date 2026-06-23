# @deijose/nix-js-auth

[![npm version](https://img.shields.io/npm/v/@deijose/nix-js-auth.svg)](https://www.npmjs.com/package/@deijose/nix-js-auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Authentication and authorization for [Nix.js](https://nix-js.dev) built entirely on signals.

- **Agnostic core**: bring your own driver (JWT, session cookie, API key, custom backend, etc.).
- **Reactive by default**: `auth.user`, `auth.isAuthenticated`, `auth.can(...)` are all signals.
- **Policy engine**: define fine-grained access rules with `createPolicy` and reusable helpers.
- **Router integration**: declarative `meta.auth` DSL and standalone guards.
- **Optional `provide/inject`**: works without it, but supports `useAuth()` if you want it.

## Installation

```bash
npm install @deijose/nix-js @deijose/nix-js-auth
```

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
console.log(auth.can("post:edit", { authorId: "42" }).value);
```

## Drivers

A driver is a small object that tells `createAuth` how to authenticate against your backend.

```ts
const myDriver = {
  name: "my-backend",
  async login(credentials) {
    const res = await fetch("/api/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    return res.json();
  },
  async logout(session) {
    await fetch("/api/logout", { headers: { Authorization: `Bearer ${session.token}` } });
  },
  toUser(session) {
    return session.user;
  },
  getToken(session) {
    return session.token;
  },
  getExpiry(session) {
    return session.expiresAt;
  },
};

const auth = createAuth({ driver: myDriver });
```

### Official drivers

- `jwtDriver(options)` — JWT / Bearer token flow.
- `mockDriver(options)` — useful for testing and prototyping.

### Official providers

- `credentialsProvider(options)` — a driver for email/password or any custom credentials.

## Storage adapters

- `localStorageAdapter({ key })`
- `sessionStorageAdapter({ key })`
- `memoryAdapter()`

## Policy engine

```ts
import { createPolicy, hasRole, hasPermission, isOwner, any } from "@deijose/nix-js-auth";

auth.attachPolicy(
  createPolicy((user, action, context) => {
    if (!user) return false;

    if (action === "admin:dashboard") return hasRole("admin")(user);
    if (action === "post:edit") {
      return any(
        hasPermission("post:edit"),
        isOwner("post", context.id),
      )(user, context);
    }
    return false;
  }),
);
```

### RBAC convenience

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
]);

router.beforeEach(
  authRouterPlugin(auth, router, {
    public: ["/login", "/register"],
    defaultRedirect: "/login",
    fallbackRedirect: "/unauthorized",
  }),
);
```

### Meta DSL

The `meta.auth` field accepts:

- `"public"` or `false` — no auth required.
- `"optional"` — auth is optional.
- `string` or `string[]` — `auth.can(action)` must be true.
- object:
  - `can` — action to check.
  - `role`, `roles`, `permission`, `permissions` — identity checks.
  - `provider` — require a specific provider.
  - `redirect` — custom redirect path.
  - `allow` — boolean or custom function.
- function — full custom guard.

### Standalone guards

```ts
import { requireAuth, requireRole, requirePermission } from "@deijose/nix-js-auth";

router.beforeEach(requireAuth(auth, "/login"));
router.beforeEach(requireRole(auth, "admin", "/unauthorized"));
router.beforeEach(requirePermission(auth, "post:edit", "/unauthorized"));
```

## Optional provide/inject

```ts
import { AuthKey, useAuth } from "@deijose/nix-js-auth";
import { provide } from "@deijose/nix-js";

provide(AuthKey, auth);

// In a descendant component:
const auth = useAuth();
```

## Multi-provider

```ts
const auth = createAuth({
  providers: {
    credentials: credentialsProvider({ login: ... }),
    apiKey: mockDriver({ ... }),
  },
  defaultProvider: "credentials",
});

await auth.login("credentials", { email, password });
await auth.login("apiKey", { key: "secret" });
```

## Custom authorization

If your user model does not have `roles`/`permissions`, use a custom driver and custom policies:

```ts
const auth = createAuth({
  driver: {
    name: "legacy",
    async login(creds) {
      const res = await fetch("/legacy/auth", { body: JSON.stringify(creds) });
      return res.json();
    },
    async logout(session) { /* ... */ },
    toUser(session) {
      return session.employee;
    },
  },
});

auth.attachPolicy(
  createPolicy((user, action, context) => {
    if (!user) return false;
    if (action === "payroll:approve") {
      return user.privileges?.includes("PAYROLL_APPROVER") && user.department === context.department;
    }
    return false;
  }),
);
```

## API overview

### Core

- `createAuth(options)` — reactive auth instance.
- `auth.login(credentials)` / `auth.login("provider", credentials)`
- `auth.logout()` / `auth.refresh()` / `auth.ready()`
- `auth.session`, `auth.user`, `auth.token`, `auth.isAuthenticated`, `auth.isReady`, `auth.isLoading`, `auth.error`
- `auth.setSession(session)`, `auth.clearSession()`
- `auth.attachPolicy(policy)`, `auth.detachPolicy(policy)`
- `auth.can(action, context?)`, `auth.authorize(action, context?)`
- `auth.hasRole(role)`, `auth.hasPermission(permission)`, `auth.hasScope(scope)`
- `auth.hasAnyRole(roles)`, `auth.hasAllPermissions(permissions)`

### Router

- `authRouterPlugin(auth, router, options)`
- `requireAuth(auth, redirect?)`
- `requireRole(auth, role, redirect?)`
- `requirePermission(auth, permission, redirect?)`
- `requireProvider(auth, provider, redirect?)`
- `requirePolicy(auth, predicate, redirect?)`

## License

MIT
