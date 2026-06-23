# Changelog

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
