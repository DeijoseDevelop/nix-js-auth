import { createPolicy } from "./createPolicy";
import type { AuthPolicy } from "../core/types";

export interface RbacPolicyOptions<User> {
  resolveRoles?: (user: User) => string[];
  resolvePermissions?: (user: User) => string[];
}

export function rbacPolicy<User = unknown>(
  options: RbacPolicyOptions<User> = {},
): AuthPolicy<User, unknown> {
  const resolveRoles = options.resolveRoles ?? ((user: unknown) => ((user as Record<string, unknown>)?.roles as string[]) ?? []);
  const resolvePermissions =
    options.resolvePermissions ??
    ((user: unknown) => ((user as Record<string, unknown>)?.permissions as string[]) ?? []);

  return createPolicy<User, unknown>((user, action) => {
    if (!user) return false;
    if (action.startsWith("role:")) {
      const role = action.slice(5);
      return resolveRoles(user).includes(role);
    }
    if (action.startsWith("permission:")) {
      const permission = action.slice(11);
      return resolvePermissions(user).includes(permission);
    }
    return false;
  });
}
