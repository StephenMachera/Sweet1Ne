export type Me = {
  id: string;
  email: string;
  full_name: string | null;
  branch_id: string | null;
  branch_slug: string | null;
  role_name: string;
  permissions: string[];
  is_super_admin: boolean;
};

/** Super-admins bypass every check; a null permission means "any logged-in
 *  staff member". */
export function hasPermission(me: Me | null, permission: string | null): boolean {
  if (!me) return false;
  if (permission === null) return true;
  if (me.is_super_admin) return true;
  return me.permissions.includes(permission);
}

/**
 * Where someone lands after logging in.
 *
 * Surfaces are checked in priority order — a head chef with reports access
 * gets the dashboard and navigates to the kitchen deliberately, rather than
 * being dropped into a station screen.
 */
export function landingPath(me: Me): string {
  const base = me.branch_slug ? `/${me.branch_slug}` : "/admin";
  const has = (key: string) => hasPermission(me, key);

  if (has("access_reports")) return `${base}/dashboard`;
  if (has("access_kitchen")) return `${base}/kitchen`;
  if (has("access_bar")) return `${base}/bar`;
  if (has("view_menu")) return `${base}/menu`;
  if (has("view_orders")) return `${base}/orders`;

  return `${base}/dashboard`;
}