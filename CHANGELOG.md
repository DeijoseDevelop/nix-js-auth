# Changelog

## 1.1.0

### Added

- Non-reactive authorization helpers on `AuthInstance`: `checkCan`, `checkAuthorize`, `checkRole`, `checkPermission`, `checkScope`, `checkAnyRole`, `checkAllPermissions`. These return plain values instead of signals and are ideal for router guards and one-off checks.
- `dispose()` on `AuthInstance` to release the pending auto-refresh timer and prevent leaks when instances are discarded (SSR-per-request, tests).

### Changed

- **Performance:** removed the redundant `watch(session, ...)` that scheduled the auto-refresh a second time on every session change; scheduling now happens once via `setSession`.
- **Performance:** router guards (`requireRole`, `requirePermission`) and `authRouterPlugin` now use the non-reactive `check*` helpers instead of creating throwaway `computed` signals on every navigation.
- **Performance:** `user` roles/permissions/scopes are now derived via memoized `computed`s and reused across reactive and non-reactive checks.
- **Performance:** `ready()` memoizes the in-flight hydration promise, so concurrent calls (e.g. multiple navigations during startup) no longer trigger duplicate `storage.get()` reads.
- **Performance:** `oidcProvider.resolveMetadata()` memoizes the discovery promise to deduplicate concurrent metadata fetches (resets on error to allow retry).

## 1.0.1

### Changed

- Improved README documentation: added full API overview and updated FAQ for v1.0.0 features.

## 1.0.0

### Added

- `createAuthManager` for managing multiple named auth instances.
- `oidcProvider` — basic OIDC driver with PKCE, discovery, login/logout URL builders.
- `rbacPolicy` tenant support via `resolveRoles(user, tenant)` and `resolvePermissions(user, tenant)`.
- SSR `seed` option in `createAuth` for server-side rendering.

### Changed

- Library reaches 1.0.0 stable API.

## 0.2.0

### Added

- `sessionCookieDriver` for `httpOnly` session cookie authentication.
- `apiKeyProvider` for API-key authentication.
- `cookieAdapter` storage adapter for `document.cookie` persistence.
- Custom `autoRefresh` schedule support via `AutoRefreshOptions<Session>`.
- Optional `nix-query` integration via the `@deijose/nix-js-auth/command` subpath.
  - `authCommand` — injects the current token into command context.
  - `createLoginCommand` / `createLogoutCommand` — wrap `auth.login` and `auth.logout` as commands.
  - `authHeaders` — helper to build `Authorization` headers.
- `hydrate` is now called even when storage is empty, enabling session recovery from the server.

### Changed

- Refactored test suite into module-based files.

## 0.1.0

### Added

- Reactive core: `createAuth` with `session`, `user`, `token`, `isAuthenticated`, `isReady`, `isLoading`, `error` signals.
- Driver-based architecture: `jwtDriver`, `mockDriver`, and support for custom drivers.
- Provider/strategy support: `credentialsProvider` and `providers` map in `createAuth`.
- Storage adapters: `localStorageAdapter`, `sessionStorageAdapter`, `memoryAdapter`.
- Policy engine: `createPolicy`, `rbacPolicy`, and helpers `hasRole`, `hasPermission`, `hasScope`, `isOwner`, `all`, `any`, `not`.
- Router integration: `authRouterPlugin` with declarative `meta.auth` DSL.
- Standalone guards: `requireAuth`, `requireRole`, `requirePermission`, `requireProvider`, `requirePolicy`.
- Optional `provide/inject` support via `AuthKey` and `useAuth`.
- Identity mapping for dynamic role/permission/scope fields.
- Auto-refresh based on driver-provided expiry.
- Full TypeScript support and Vitest test coverage.
