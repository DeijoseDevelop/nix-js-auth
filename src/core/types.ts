import type { Signal } from "@deijose/nix-js";

export type AuthEvent =
  | "login"
  | "logout"
  | "refresh"
  | "hydrate"
  | "setSession"
  | "clearSession";

export interface AuthDriver<Session = unknown, User = unknown, Credentials = unknown> {
  readonly name: string;

  login(credentials: Credentials): Promise<Session>;
  logout(session: Session): Promise<void>;

  hydrate?(raw: unknown): Promise<Session | null>;
  refresh?(session: Session): Promise<Session>;
  getExpiry?(session: Session): number | undefined;
  toUser?(session: Session): User;
  getToken?(session: Session): string | null;
  isValid?(session: Session): boolean;
}

export interface AuthStorage<Session> {
  get(): Session | null | Promise<Session | null>;
  set(session: Session | null): void | Promise<void>;
  remove(): void | Promise<void>;
}

export type IdentityResolver<User> = string | ((user: User) => string[]);

export interface AuthIdentity<User> {
  roles?: IdentityResolver<User>;
  permissions?: IdentityResolver<User>;
  scopes?: IdentityResolver<User>;
}

export interface AutoRefreshOptions<Session> {
  beforeExpirySeconds?: number;
  schedule?: (session: Session, refresh: () => Promise<void>) => (() => void);
}

export interface CreateAuthOptions<Session, User, Credentials> {
  driver?: AuthDriver<Session, User, Credentials>;
  providers?: Record<string, AuthDriver<Session, User, Credentials>>;
  defaultProvider?: string;

  storage?: AuthStorage<Session>;
  autoRefresh?: boolean | AutoRefreshOptions<Session>;
  seed?: Session | (() => Session | null);

  identity?: AuthIdentity<User>;

  onChange?: (session: Session | null) => void;
  onError?: (error: unknown, event: AuthEvent) => void;

  name?: string;
}

export type PolicyDecision = boolean | { allow: boolean; redirect?: string };

export interface AuthPolicy<User, Session = unknown> {
  readonly name?: string;
  evaluate(
    user: User | null,
    action: string,
    context: unknown,
    session: Session | null,
  ): PolicyDecision;
}

export interface AuthInstance<Session = unknown, User = unknown, Credentials = unknown> {
  readonly name: string;

  readonly session: Signal<Session | null>;
  readonly user: Signal<User | null>;
  readonly token: Signal<string | null>;

  readonly isAuthenticated: Signal<boolean>;
  readonly isAnonymous: Signal<boolean>;
  readonly isReady: Signal<boolean>;
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<unknown>;
  readonly activeProvider: Signal<string | null>;

  login(credentials: Credentials): Promise<void>;
  login(provider: string, credentials: Credentials): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
  ready(): Promise<void>;
  setSession(session: Session | null): void;
  clearSession(): void;

  attachPolicy(policy: AuthPolicy<User, Session>): () => void;
  detachPolicy(policy: AuthPolicy<User, Session>): void;
  can(action: string, context?: unknown): Signal<boolean>;
  authorize(action: string, context?: unknown): Signal<{ allow: boolean; redirect?: string }>;

  hasRole(role: string): Signal<boolean>;
  hasPermission(permission: string): Signal<boolean>;
  hasScope(scope: string): Signal<boolean>;
  hasAnyRole(roles: string[]): Signal<boolean>;
  hasAllPermissions(permissions: string[]): Signal<boolean>;
}
