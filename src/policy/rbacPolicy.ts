import { createPolicy } from "./createPolicy";
import type { AuthPolicy } from "../core/types";

export interface RbacPolicyOptions<User> {
  resolveRoles?: (user: User, tenant?: string) => string[];
  resolvePermissions?: (user: User, tenant?: string) => string[];
}

export function rbacPolicy<User = unknown>(
  options: RbacPolicyOptions<User> = {},
): AuthPolicy<User, unknown> {
  const resolveRoles =
    options.resolveRoles ??
    ((user: unknown) => ((user as Record<string, unknown>)?.roles as string[]) ?? []);
  const resolvePermissions =
    options.resolvePermissions ??
    ((user: unknown) => ((user as Record<string, unknown>)?.permissions as string[]) ?? []);

  return createPolicy<User, unknown>((user, action, context) => {
    if (!user) return false;
    const tenant = (context as { tenant?: string } | undefined)?.tenant;
    if (action.startsWith("role:")) {
      const role = action.slice(5);
      return resolveRoles(user, tenant).includes(role);
    }
    if (action.startsWith("permission:")) {
      const permission = action.slice(11);
      return resolvePermissions(user, tenant).includes(permission);
    }
    return false;
  });
}
