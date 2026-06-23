import { describe, it, expect } from "vitest";
import { hasRole, hasPermission, hasScope, isOwner, all, any, not } from "../policy/helpers";
import { rbacPolicy } from "../policy/rbacPolicy";

describe("policy helpers", () => {
  it("hasRole checks user roles", () => {
    const user = { roles: ["admin", "editor"] };
    expect(hasRole("admin")(user, undefined, null)).toBe(true);
    expect(hasRole("user")(user, undefined, null)).toBe(false);
  });

  it("hasPermission checks user permissions", () => {
    const user = { permissions: ["post:edit"] };
    expect(hasPermission("post:edit")(user, undefined, null)).toBe(true);
    expect(hasPermission("post:delete")(user, undefined, null)).toBe(false);
  });

  it("hasScope checks user scopes", () => {
    const user = { scopes: ["read", "write"] };
    expect(hasScope("read")(user, undefined, null)).toBe(true);
    expect(hasScope("admin")(user, undefined, null)).toBe(false);
  });

  it("isOwner compares user id with context id", () => {
    const user = { id: "42" };
    expect(isOwner("post")(user, { id: "42" }, null)).toBe(true);
    expect(isOwner("post")(user, { id: "99" }, null)).toBe(false);
  });

  it("all combines checks", () => {
    const user = { roles: ["admin"], permissions: ["post:edit"] };
    const check = all(hasRole("admin"), hasPermission("post:edit"));
    expect(check(user, undefined, null)).toBe(true);

    const failing = all(hasRole("admin"), hasPermission("post:delete"));
    expect(failing(user, undefined, null)).toBe(false);
  });

  it("any combines checks", () => {
    const user = { roles: ["editor"] };
    const check = any(hasRole("admin"), hasRole("editor"));
    expect(check(user, undefined, null)).toBe(true);
  });

  it("not inverts a check", () => {
    const user = { roles: ["user"] };
    expect(not(hasRole("admin"))(user, undefined, null)).toBe(true);
    expect(not(hasRole("user"))(user, undefined, null)).toBe(false);
  });
});

describe("rbacPolicy", () => {
  it("allows role: and permission: actions", () => {
    const policy = rbacPolicy({
      resolveRoles: (u) => (u as { roles: string[] }).roles,
      resolvePermissions: (u) => (u as { permissions: string[] }).permissions,
    });

    const user = { roles: ["admin"], permissions: ["post:edit"] };
    expect(policy.evaluate(user, "role:admin", null, null)).toBe(true);
    expect(policy.evaluate(user, "role:user", null, null)).toBe(false);
    expect(policy.evaluate(user, "permission:post:edit", null, null)).toBe(true);
    expect(policy.evaluate(user, "permission:post:delete", null, null)).toBe(false);
  });
});
