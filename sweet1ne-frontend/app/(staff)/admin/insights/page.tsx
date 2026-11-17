"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { apiFetch } from "@/lib/api";
import { InsightsView } from "@/components/insights/insights-view";
import { AdminLoading } from "@/components/admin/admin-loading";

type Branch = { id: string; name: string };

export default function AdminInsightsPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const canView = hasPermission(me, "access_reports");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");

  useEffect(() => {
    apiFetch("/branches").then(setBranches).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (loading || !me) return;
    if (!canView) router.replace("/admin/dashboard");
  }, [me, loading, canView, router]);

  if (loading || !me || !canView) {
    return <AdminLoading />;
  }

  return (
    <>
      <h1>Insights</h1>

      <div className="admin-places" role="group" aria-label="Branch">
        <button type="button" className={branchFilter === "" ? "is-on" : undefined} onClick={() => setBranchFilter("")}>
          All
        </button>
        {branches.map((b) => (
          <button
            key={b.id}
            type="button"
            className={branchFilter === b.id ? "is-on" : undefined}
            onClick={() => setBranchFilter(b.id)}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div style={{ marginTop: "1.25rem" }}>
        <InsightsView branchId={branchFilter} central />
      </div>
    </>
  );
}
