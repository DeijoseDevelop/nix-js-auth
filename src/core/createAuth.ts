import { signal, computed, batch } from "@deijose/nix-js";
import type { Signal } from "@deijose/nix-js";
import type {
  AuthDriver,
  AuthPolicy,
  AuthIdentity,
  CreateAuthOptions,
  AuthInstance,
  PolicyDecision,
} from "./types";

function makeResolver<User>(
  identity: AuthIdentity<User> | undefined,
  key: keyof AuthIdentity<User>,
  defaultKey: string,
): (user: User | null) => string[] {
  return (user: User | null) => {
    if (!user) return [];
    const resolver = identity?.[key];
    if (typeof resolver === "function") {
      return resolver(user) ?? [];
    }
    const field = typeof resolver === "string" ? resolver : defaultKey;
    return ((user as Record<string, unknown>)[field] as string[]) ?? [];
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createAuth<
  Session = unknown,
  User = unknown,
  Credentials = unknown,
>(
  options: CreateAuthOptions<Session, User, Credentials>,
): AuthInstance<Session, User, Credentials> {
  const {
    driver,
    providers,
    defaultProvider,
    storage,
    autoRefresh,
    seed,
    identity,
    onChange,
    onError,
    name = "default",
  } = options;

  if (!driver && !providers) {
    throw new Error("[nix-auth] createAuth requires either a 'driver' or 'providers' option.");
  }

  const providerMap = providers ?? {};
  const hasProviders = Object.keys(providerMap).length > 0;
  const activeDriver = signal<AuthDriver<Session, User, Credentials> | null>(
    driver ?? (defaultProvider ? providerMap[defaultProvider] : null) ?? null,
  );
  const activeProvider = signal<string | null>(
    driver ? driver.name : defaultProvider ?? null,
  );

  const session = signal<Session | null>(null);
  const isReady = signal(false);
  const isLoading = signal(false);
  const error = signal<unknown>(null);
  const policiesVersion = signal(0);

  const policies: AuthPolicy<User, Session>[] = [];

  const resolveRoles = makeResolver<User>(identity, "roles", "roles");
  const resolvePermissions = makeResolver<User>(identity, "permissions", "permissions");
  const resolveScopes = makeResolver<User>(identity, "scopes", "scopes");

  const user = computed<User | null>(() => {
    const s = session.value;
    if (s === null) return null;
    const d = activeDriver.value;
    if (d?.toUser) return d.toUser(s);
    return s as unknown as User;
  });

  const token = computed<string | null>(() => {
    const s = session.value;
    if (s === null) return null;
    const d = activeDriver.value;
    if (d?.getToken) return d.getToken(s);
    const raw = s as unknown as Record<string, unknown>;
    return (raw.token as string | undefined) ?? (raw.accessToken as string | undefined) ?? null;
  });

  const isAuthenticated = computed(() => user.value !== null);
  const isAnonymous = computed(() => user.value === null);

  const userRoles = computed(() => resolveRoles(user.value));
  const userPermissions = computed(() => resolvePermissions(user.value));
  const userScopes = computed(() => resolveScopes(user.value));

  const autoRefreshEnabled = Boolean(autoRefresh);
  const autoRefreshConfig = typeof autoRefresh === "object" ? autoRefresh : {};

  let refreshDispose: (() => void) | null = null;

  function clearAutoRefresh() {
    if (refreshDispose) {
      refreshDispose();
      refreshDispose = null;
    }
  }

  function defaultSchedule(session: Session, refresh: () => Promise<void>): () => void {
    const d = activeDriver.value;
    const expiresAt = d?.getExpiry?.(session);
    if (!expiresAt) return () => { };
    const beforeMs = (autoRefreshConfig.beforeExpirySeconds ?? 60) * 1000;
    const delay = Math.max(0, expiresAt - Date.now() - beforeMs);
    const timer = setTimeout(() => {
      void refresh();
    }, delay);
    return () => clearTimeout(timer);
  }

  function scheduleAutoRefresh(s: Session) {
    clearAutoRefresh();
    if (!autoRefreshEnabled) return;
    const scheduler = autoRefreshConfig.schedule ?? defaultSchedule;
    refreshDispose = scheduler(s, refresh);
  }

  function setSession(next: Session | null) {
    batch(() => {
      session.value = next;
      error.value = null;
    });
    if (storage) {
      try {
        void storage.set(next);
      } catch (err) {
        onError?.(err, "setSession");
      }
    }
    onChange?.(next);
    if (next) {
      scheduleAutoRefresh(next);
    } else {
      clearAutoRefresh();
    }
  }

  function clearSession() {
    clearAutoRefresh();
    setSession(null);
    if (hasProviders) {
      activeDriver.value = defaultProvider ? providerMap[defaultProvider] : null;
      activeProvider.value = defaultProvider ?? null;
    }
  }

  async function resolveDriver(
    provider?: string,
  ): Promise<AuthDriver<Session, User, Credentials>> {
    const d = provider ? providerMap[provider] : activeDriver.value;
    if (!d) {
      throw new Error(
        `[nix-auth] No driver available${provider ? ` for provider '${provider}'` : ""}.`,
      );
    }
    if (provider) {
      batch(() => {
        activeDriver.value = d;
        activeProvider.value = provider;
      });
    }
    return d;
  }

  async function login(...args: [Credentials] | [string, Credentials]): Promise<void> {
    const [first, second] = args;
    const providerName = typeof first === "string" ? first : undefined;
    const credentials = (providerName ? second : first) as Credentials;

    const d = await resolveDriver(providerName);
    isLoading.value = true;
    error.value = null;
    try {
      const next = await d.login(credentials);
      setSession(next);
    } catch (err) {
      error.value = err;
      onError?.(err, "login");
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function logout(): Promise<void> {
    const current = session.value;
    const d = activeDriver.value;
    if (current && d) {
      try {
        await d.logout(current);
      } catch (err) {
        onError?.(err, "logout");
      }
    }
    clearSession();
  }

  async function refresh(): Promise<void> {
    const current = session.value;
    const d = activeDriver.value;
    if (!current || !d?.refresh) return;
    isLoading.value = true;
    try {
      const next = await d.refresh(current);
      setSession(next);
    } catch (err) {
      error.value = err;
      onError?.(err, "refresh");
      await logout();
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  let readyPromise: Promise<void> | null = null;

  function ready(): Promise<void> {
    if (isReady.value) return Promise.resolve();
    if (readyPromise) return readyPromise;
    readyPromise = hydrate();
    return readyPromise;
  }

  async function hydrate(): Promise<void> {
    const d = activeDriver.value;
    if (!storage) {
      isReady.value = true;
      return;
    }
    try {
      const raw = await storage.get();
      let hydrated: Session | null = null;
      if (d?.hydrate) {
        hydrated = await d.hydrate(raw);
      } else if (raw !== null) {
        hydrated = raw;
        if (d?.isValid && !d.isValid(raw)) {
          hydrated = null;
        }
      }
      if (hydrated !== null) {
        setSession(hydrated);
      }
    } catch (err) {
      error.value = err;
      onError?.(err, "hydrate");
    } finally {
      isReady.value = true;
    }
  }

  function isSeedFunction(
    value: Session | (() => Session | null) | undefined,
  ): value is () => Session | null {
    return typeof value === "function";
  }

  // Seed initial session for SSR / server render
  const initialSeed = isSeedFunction(seed) ? seed() : seed;
  if (initialSeed) {
    setSession(initialSeed);
  }

  // Initialize hydration asynchronously
  void ready();

  function attachPolicy(policy: AuthPolicy<User, Session>): () => void {
    policies.push(policy);
    policiesVersion.value++;
    return () => detachPolicy(policy);
  }

  function detachPolicy(policy: AuthPolicy<User, Session>) {
    const index = policies.indexOf(policy);
    if (index >= 0) {
      policies.splice(index, 1);
      policiesVersion.value++;
    }
  }

  function resolveContext(context?: unknown): unknown {
    return typeof context === "function" ? context() : context;
  }

  function evaluatePolicies(action: string, context: unknown): PolicyDecision {
    const u = user.value;
    const s = session.value;
    const ctx = resolveContext(context);
    for (const policy of policies) {
      const result = policy.evaluate(u, action, ctx, s);
      if (typeof result === "object" && result !== null) {
        return result;
      }
      if (result === true) return true;
      if (result === false) return false;
    }
    return false;
  }

  function checkCan(action: string, context?: unknown): boolean {
    const result = evaluatePolicies(action, context);
    return isObject(result) ? result.allow : result;
  }

  function checkAuthorize(
    action: string,
    context?: unknown,
  ): { allow: boolean; redirect?: string } {
    const result = evaluatePolicies(action, context);
    if (isObject(result)) {
      return { allow: result.allow, redirect: result.redirect };
    }
    return { allow: result };
  }

  function checkRole(role: string): boolean {
    return userRoles.value.includes(role);
  }

  function checkPermission(permission: string): boolean {
    return userPermissions.value.includes(permission);
  }

  function checkScope(scope: string): boolean {
    return userScopes.value.includes(scope);
  }

  function checkAnyRole(roles: string[]): boolean {
    const current = userRoles.value;
    return roles.some((role) => current.includes(role));
  }

  function checkAllPermissions(permissions: string[]): boolean {
    const current = userPermissions.value;
    return permissions.every((permission) => current.includes(permission));
  }

  function can(action: string, context?: unknown): Signal<boolean> {
    return computed(() => {
      policiesVersion.value; // subscribe to policy changes
      return checkCan(action, context);
    });
  }

  function authorize(
    action: string,
    context?: unknown,
  ): Signal<{ allow: boolean; redirect?: string }> {
    return computed(() => {
      policiesVersion.value; // subscribe to policy changes
      return checkAuthorize(action, context);
    });
  }

  function hasRole(role: string): Signal<boolean> {
    return computed(() => checkRole(role));
  }

  function hasPermission(permission: string): Signal<boolean> {
    return computed(() => checkPermission(permission));
  }

  function hasScope(scope: string): Signal<boolean> {
    return computed(() => checkScope(scope));
  }

  function hasAnyRole(roles: string[]): Signal<boolean> {
    return computed(() => checkAnyRole(roles));
  }

  function hasAllPermissions(permissions: string[]): Signal<boolean> {
    return computed(() => checkAllPermissions(permissions));
  }

  function dispose(): void {
    clearAutoRefresh();
  }

  return {
    name,
    session,
    user,
    token,
    isAuthenticated,
    isAnonymous,
    isReady,
    isLoading,
    error,
    activeProvider,
    login,
    logout,
    refresh,
    ready,
    setSession,
    clearSession,
    attachPolicy,
    detachPolicy,
    can,
    authorize,
    hasRole,
    hasPermission,
    hasScope,
    hasAnyRole,
    hasAllPermissions,
    checkCan,
    checkAuthorize,
    checkRole,
    checkPermission,
    checkScope,
    checkAnyRole,
    checkAllPermissions,
    dispose,
  };
}
