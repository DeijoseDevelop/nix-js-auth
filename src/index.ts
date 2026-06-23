export { createAuth } from "./core/createAuth";
export { createAuthManager } from "./core/authManager";
export type { AuthManager } from "./core/authManager";
export type {
  AuthInstance,
  AuthDriver,
  AuthStorage,
  AuthPolicy,
  CreateAuthOptions,
  AuthIdentity,
  IdentityResolver,
  PolicyDecision,
  AuthEvent,
  AutoRefreshOptions,
} from "./core/types";

export { jwtDriver } from "./drivers/jwtDriver";
export type { JwtSession, JwtCredentials, JwtDriverOptions } from "./drivers/jwtDriver";

export { sessionCookieDriver } from "./drivers/sessionCookieDriver";
export type {
  SessionCookieSession,
  SessionCookieCredentials,
  SessionCookieDriverOptions,
} from "./drivers/sessionCookieDriver";

export { mockDriver } from "./drivers/mockDriver";
export type { MockDriverOptions } from "./drivers/mockDriver";

export { credentialsProvider } from "./providers/credentialsProvider";
export type { CredentialsProviderOptions } from "./providers/credentialsProvider";

export { apiKeyProvider } from "./providers/apiKeyProvider";
export type { ApiKeyProviderOptions, ApiKeyCredentials } from "./providers/apiKeyProvider";

export { oidcProvider } from "./providers/oidcProvider";
export type {
  OidcProviderOptions,
  OidcCredentials,
  OidcSession,
  OidcLoginUrl,
  OidcProvider,
} from "./providers/oidcProvider";

export { localStorageAdapter } from "./storage/localStorageAdapter";
export type { LocalStorageAdapterOptions } from "./storage/localStorageAdapter";

export { sessionStorageAdapter } from "./storage/sessionStorageAdapter";
export type { SessionStorageAdapterOptions } from "./storage/sessionStorageAdapter";

export { cookieAdapter } from "./storage/cookieAdapter";
export type { CookieAdapterOptions } from "./storage/cookieAdapter";

export { memoryAdapter } from "./storage/memoryAdapter";

export { createPolicy } from "./policy/createPolicy";
export type { PolicyEvaluator } from "./policy/createPolicy";

export {
  hasRole,
  hasPermission,
  hasScope,
  isOwner,
  all,
  any,
  not,
} from "./policy/helpers";
export type { PolicyCheck } from "./policy/helpers";

export { rbacPolicy } from "./policy/rbacPolicy";
export type { RbacPolicyOptions } from "./policy/rbacPolicy";

export { authRouterPlugin } from "./router/plugin";
export type { AuthRouterPluginOptions } from "./router/plugin";

export {
  requireAuth,
  requireRole,
  requirePermission,
  requireProvider,
  requirePolicy,
} from "./router/guards";

export type {
  RouteAuthMeta,
  RouteAuthMetaObject,
  RouteAuthMetaFunction,
  MetaInterpreter,
} from "./router/meta";

export { AuthKey, useAuth } from "./inject";
