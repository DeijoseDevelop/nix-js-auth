# Changelog

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
