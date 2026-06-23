import { createInjectionKey, inject } from "@deijose/nix-js";
import type { AuthInstance } from "./core/types";

export const AuthKey = createInjectionKey<AuthInstance<unknown, unknown>>("nix:auth");

export function useAuth<Session = unknown, User = unknown>(): AuthInstance<Session, User> | undefined {
  return inject(AuthKey) as AuthInstance<Session, User> | undefined;
}
