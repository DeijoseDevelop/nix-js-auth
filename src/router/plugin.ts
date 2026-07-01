import type { Router, NavigationGuard, NavigationGuardResult } from "@deijose/nix-js/router";
import type { AuthInstance } from "../core/types";
import type { RouteAuthMeta, RouteAuthMetaObject, MetaInterpreter } from "./meta";
import { isPublic } from "./meta";

export interface AuthRouterPluginOptions {
  public?: (string | RegExp)[];
  defaultRedirect?: string;
  fallbackRedirect?: string;
  interpretMeta?: MetaInterpreter;
}

function isPublicPath(path: string, patterns: (string | RegExp)[]): boolean {
  return patterns.some((pattern) =>
    typeof pattern === "string" ? path === pattern : pattern.test(path),
  );
}

function resolveContext(context?: unknown): unknown {
  return typeof context === "function" ? context() : context;
}

function defaultCanMeta(
  meta: string | string[],
  auth: AuthInstance,
  fallbackRedirect: string,
): NavigationGuardResult {
  const actions = Array.isArray(meta) ? meta : [meta];
  const allowed = actions.some((action) => auth.checkCan(action));
  return allowed ? undefined : fallbackRedirect;
}

async function defaultObjectMeta(
  meta: RouteAuthMetaObject,
  auth: AuthInstance,
  to: string,
  from: string,
  fallbackRedirect: string,
): Promise<NavigationGuardResult> {
  const redirect = meta.redirect ?? fallbackRedirect;

  if (meta.provider && auth.activeProvider.value !== meta.provider) {
    return redirect;
  }

  if (meta.can) {
    const context = resolveContext(meta.context);
    return auth.checkCan(meta.can, context) ? undefined : redirect;
  }

  if (meta.role && !auth.checkRole(meta.role)) {
    return redirect;
  }

  if (meta.roles && !auth.checkAnyRole(meta.roles)) {
    return redirect;
  }

  if (meta.permission && !auth.checkPermission(meta.permission)) {
    return redirect;
  }

  if (meta.permissions && !auth.checkAllPermissions(meta.permissions)) {
    return redirect;
  }

  if (meta.allow === false) {
    return redirect;
  }

  if (typeof meta.allow === "function") {
    const raw = await meta.allow(to, from, auth);
    return raw === true || raw === undefined || raw === null ? undefined : raw === false ? redirect : raw;
  }

  return undefined;
}

async function defaultMetaInterpreter(
  meta: RouteAuthMeta | undefined,
  auth: AuthInstance,
  to: string,
  from: string,
  fallbackRedirect: string,
): Promise<NavigationGuardResult> {
  if (isPublic(meta)) {
    return undefined;
  }

  if (meta === "optional") {
    return undefined;
  }

  if (typeof meta === "string") {
    return defaultCanMeta(meta, auth, fallbackRedirect);
  }

  if (Array.isArray(meta)) {
    return defaultCanMeta(meta, auth, fallbackRedirect);
  }

  if (typeof meta === "function") {
    return await meta(to, from, auth);
  }

  if (meta && typeof meta === "object") {
    return defaultObjectMeta(meta, auth, to, from, fallbackRedirect);
  }

  return undefined;
}

export function authRouterPlugin<Session, User>(
  auth: AuthInstance<Session, User>,
  router: Router,
  options: AuthRouterPluginOptions = {},
): NavigationGuard {
  const {
    public: publicPaths = [],
    defaultRedirect = "/login",
    fallbackRedirect = "/unauthorized",
    interpretMeta,
  } = options;

  return async (to, from) => {
    await auth.ready();

    if (isPublicPath(to, publicPaths)) {
      return undefined;
    }

    if (!auth.isAuthenticated.value) {
      return defaultRedirect;
    }

    const resolved = router.resolve(to);
    const meta = resolved.route?.meta?.auth as RouteAuthMeta | undefined;

    if (interpretMeta) {
      return await interpretMeta(meta, auth, to, from);
    }

    return await defaultMetaInterpreter(meta, auth, to, from, fallbackRedirect);
  };
}
