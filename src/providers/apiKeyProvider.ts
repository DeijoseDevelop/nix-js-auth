import type { AuthDriver } from "../core/types";

export interface ApiKeyProviderOptions<Session = unknown, User = unknown> {
  name?: string;
  validate: (apiKey: string) => Promise<Session>;
  logout?: (session: Session) => Promise<void>;
  toUser?: (session: Session) => User;
  getToken?: (session: Session) => string | null;
  getExpiry?: (session: Session) => number | undefined;
  isValid?: (session: Session) => boolean;
  hydrate?: (raw: unknown) => Promise<Session | null>;
}

export interface ApiKeyCredentials {
  key: string;
}

export function apiKeyProvider<Session = unknown, User = unknown>(
  options: ApiKeyProviderOptions<Session, User>,
): AuthDriver<Session, User, ApiKeyCredentials> {
  return {
    name: options.name ?? "apiKey",
    login: async (credentials) => options.validate(credentials.key),
    logout: options.logout ?? (() => Promise.resolve()),
    refresh: undefined,
    toUser: options.toUser,
    getToken: options.getToken,
    getExpiry: options.getExpiry,
    isValid: options.isValid,
    hydrate: options.hydrate,
  };
}
