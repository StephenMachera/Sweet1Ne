"use client"

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api"

export type Me = {
  id: string;
  full_name: string | null;
  email: string;
  role_name: string;
  branch_id: string | null;
  branch_slug: string | null;
  permissions: string[];
  is_super_admin: boolean;
};

export function useMe() {
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true)

    useEffect(() =>{
        apiFetch("/auth/me")
        .then(setMe)
        .catch(console.error)
        .finally(() => setLoading(false))
    }, []);
    return { me, loading };

}

export function hasPermission(me: Me | null, permission: string | null) {
        if (permission === null) return true;
        if (!me) return false;
        return me.is_super_admin || me.permissions.includes(permission);
}

export function landingPath(me: Me) {
  const base = me.branch_slug ? `/${me.branch_slug}` : "/admin";
  const has = (key: string) => me.is_super_admin || me.permissions.includes(key);

  if (has("access_reports")) return `${base}/dashboard`;
  if (has("update_order_status")) return `${base}/kitchen`;
  if (has("access_kitchen")) return `${base}/kitchen`;
  if (has("access_bar")) return `${base}/bar`;
  if (has("view_menu")) return `${base}/menu`;
  if (has("view_orders")) return `${base}/orders`;
  return `${base}/dashboard`;
}