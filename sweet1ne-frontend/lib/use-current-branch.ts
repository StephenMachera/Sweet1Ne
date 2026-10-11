"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type CurrentBranch = {
  id: string;
  name: string;
  slug: string;
  settings?: { toast?: string; order_mode?: string; phone_menu_url?: string };
};

/**
 * Resolves the branch a [branchSlug] console page is currently on, by id —
 * not just its name/slug. Every branch-level list endpoint (menu, orders,
 * tables, station, dish-insights) scopes branch-pinned staff to their own
 * branch automatically, but a director (staff.branch_id === null) isn't
 * pinned to anything — without passing this branch's id explicitly as
 * ?branch_id=, a director browsing one branch's console would see every
 * branch's data mixed together. Every page here passes branch.id through
 * for that reason, even though it's a no-op for branch-pinned staff.
 */
export function useCurrentBranch(branchSlug: string) {
  const [branch, setBranch] = useState<CurrentBranch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/branches")
      .then((branches: CurrentBranch[]) => {
        if (cancelled) return;
        setBranch(branches.find((b) => b.slug === branchSlug) ?? null);
      })
      .catch(() => {
        if (!cancelled) setBranch(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branchSlug]);

  return { branch, loading };
}
