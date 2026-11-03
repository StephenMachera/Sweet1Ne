"use client";

import { use, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { MenuBrowser } from "@/components/menu/menu-browser";
import { useCurrentBranch } from "@/lib/use-current-branch";
import { useMe, hasPermission } from "@/lib/use-me";
import { AdminLoading } from "@/components/admin/admin-loading";

export default function MenuPreviewPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const { branch, loading } = useCurrentBranch(branchSlug);
  const canView = hasPermission(me, "view_menu") || hasPermission(me, "place_orders");

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canView) router.replace(`/${branchSlug}/welcome`);
  }, [me, meLoading, canView, branchSlug, router]);

  const scopeQuery = branch ? `?branch_id=${branch.id}` : "";
  const fetcher = useCallback(
    (path: string) => apiFetch(`/staff/menu${path}${scopeQuery}`),
    [scopeQuery]
  );

  if (meLoading || loading || !branch || !canView) {
    return <AdminLoading />;
  }

  return (
    <>
      <p className="mb-1 text-[0.7rem] uppercase tracking-[0.22em] text-[var(--gold)]">{branch.name}</p>
      <h1>The menu</h1>
      <p className="admin-dek">Everything on today&apos;s menu, with prices, allergens and offers.</p>

      <MenuBrowser key={scopeQuery} mode="preview" fetcher={fetcher} />
    </>
  );
}
