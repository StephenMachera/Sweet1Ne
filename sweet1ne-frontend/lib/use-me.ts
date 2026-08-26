"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

// The pure permission logic lives in its own module so it can be tested
// without pulling in Supabase — re-exported here so existing imports of
// `hasPermission` and `landingPath` from this file keep working.
export { hasPermission, landingPath, type Me } from "./permissions";

import type { Me } from "./permissions";

/**
 * Loads the logged-in staff member from /auth/me.
 *
 * Every page uses this to decide what to render, so it fails quietly —
 * a null `me` means "not loaded or not signed in", and the caller decides
 * what to do about it.
 */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    apiFetch("/auth/me")
      .then((data: Me) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { me, loading };
}