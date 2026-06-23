import { describe, it, expect } from "vitest";
import { rbacPolicy } from "../policy/rbacPolicy";

describe("rbacPolicy tenant support", () => {
  it("resolves roles per tenant", () => {
    const policy = rbacPolicy({
      resolveRoles: (user, tenant) => {
        const map = (user as { tenants: Record<string, string[]> }).tenants;
        return tenant ? map?.[tenant] ?? [] : [];
      },
    });

    const user = { tenants: { acme: ["admin"], globex: ["user"] } };
    expect(policy.evaluate(user, "role:admin", { tenant: "acme" }, null)).toBe(true);
    expect(policy.evaluate(user, "role:admin", { tenant: "globex" }, null)).toBe(false);
  });

  it("resolves permissions per tenant", () => {
    const policy = rbacPolicy({
      resolvePermissions: (user, tenant) => {
        const map = (user as { permissions: Record<string, string[]> }).permissions;
        return tenant ? map?.[tenant] ?? [] : [];
      },
    });

    const user = { permissions: { acme: ["post:edit"], globex: ["post:read"] } };
    expect(policy.evaluate(user, "permission:post:edit", { tenant: "acme" }, null)).toBe(true);
    expect(policy.evaluate(user, "permission:post:edit", { tenant: "globex" }, null)).toBe(false);
  });
});
