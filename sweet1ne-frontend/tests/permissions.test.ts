import { describe, expect, it } from "vitest";
import { hasPermission, landingPath, type Me } from "@/lib/permissions";

function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    id: "staff-1",
    email: "test@example.com",
    full_name: "Test Person",
    branch_id: "branch-1",
    branch_slug: "downtown",
    role_name: "Waiter",
    permissions: [],
    is_super_admin: false,
    ...overrides,
  };
}

describe("hasPermission", () => {
  it("returns false when nobody is logged in", () => {
    expect(hasPermission(null, "view_orders")).toBe(false);
  });

  it("returns false for a permission the person lacks", () => {
    const me = makeMe({ permissions: ["view_menu"] });

    expect(hasPermission(me, "manage_staff")).toBe(false);
  });

  it("returns true for a permission the person holds", () => {
    const me = makeMe({ permissions: ["view_menu", "place_orders"] });

    expect(hasPermission(me, "place_orders")).toBe(true);
  });

  it("lets a super-admin through regardless of their permission list", () => {
    const me = makeMe({ permissions: [], is_super_admin: true });

    expect(hasPermission(me, "manage_staff")).toBe(true);
  });

  it("treats a null permission as open to any logged-in staff member", () => {
    const me = makeMe({ permissions: [] });

    expect(hasPermission(me, null)).toBe(true);
  });

  it("still requires someone to be logged in for a null permission", () => {
    expect(hasPermission(null, null)).toBe(false);
  });
});

describe("landingPath", () => {
  it("sends a branch manager to their branch dashboard", () => {
    const me = makeMe({
      permissions: ["access_reports", "view_orders"],
      branch_slug: "downtown",
    });

    expect(landingPath(me)).toBe("/downtown/dashboard");
  });

  it("sends a director to the admin dashboard", () => {
    const me = makeMe({
      branch_id: null,
      branch_slug: null,
      is_super_admin: true,
    });

    expect(landingPath(me)).toBe("/admin/dashboard");
  });

  it("sends a chef to the kitchen", () => {
    const me = makeMe({
      permissions: ["access_kitchen", "view_orders", "update_order_status"],
    });

    expect(landingPath(me)).toBe("/downtown/kitchen");
  });

  it("sends a bartender to the bar", () => {
    const me = makeMe({
      permissions: ["access_bar", "view_orders", "update_order_status"],
    });

    expect(landingPath(me)).toBe("/downtown/bar");
  });

  it("sends a waiter to the menu", () => {
    const me = makeMe({
      permissions: ["view_menu", "place_orders", "view_orders"],
    });

    expect(landingPath(me)).toBe("/downtown/menu");
  });

  it("sends someone with only order access to the orders list", () => {
    const me = makeMe({ permissions: ["view_orders"] });

    expect(landingPath(me)).toBe("/downtown/orders");
  });

  it("gives reports access priority over a station", () => {
    // A head chef checking figures shouldn't be dropped onto the kitchen
    // display — they can navigate there deliberately.
    const me = makeMe({
      permissions: ["access_reports", "access_kitchen", "view_orders"],
    });

    expect(landingPath(me)).toBe("/downtown/dashboard");
  });

  it("gives the kitchen priority over the menu", () => {
    const me = makeMe({
      permissions: ["access_kitchen", "view_menu"],
    });

    expect(landingPath(me)).toBe("/downtown/kitchen");
  });

  it("falls back to the dashboard when nothing matches", () => {
    const me = makeMe({ permissions: [] });

    expect(landingPath(me)).toBe("/downtown/dashboard");
  });

  it("routes a super-admin by their branch, not their permissions", () => {
    // A super-admin passes every hasPermission check, so the first branch
    // in the chain wins — but the base path still comes from their scope.
    const me = makeMe({ is_super_admin: true, branch_slug: "westlands" });

    expect(landingPath(me)).toBe("/westlands/dashboard");
  });
});
