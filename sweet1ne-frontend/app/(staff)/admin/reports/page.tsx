"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { apiFetch } from "@/lib/api";
import { GeneralReport } from "@/components/reports/general-report";
import { RevenueReport } from "@/components/reports/revenue-report";
import { AdminLoading } from "@/components/admin/admin-loading";

type Branch = { id: string; name: string };

export default function AdminReportsPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const canView = hasPermission(me, "access_reports");

  const [tab, setTab] = useState<"general" | "revenue">("general");

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
      <h1>Reports</h1>

      <div className="admin-places" role="group" aria-label="Branch">
        <button
          type="button"
          className={branchFilter === "" ? "is-on" : undefined}
          onClick={() => setBranchFilter("")}
        >
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

      <div className="admin-cats" style={{ marginTop: "1.25rem" }} role="group" aria-label="View">
        <button type="button" className={tab === "general" ? "is-on" : undefined} onClick={() => setTab("general")}>
          General
        </button>
        <button type="button" className={tab === "revenue" ? "is-on" : undefined} onClick={() => setTab("revenue")}>
          Revenue reports
        </button>
      </div>

      {tab === "general" && <GeneralReport branchId={branchFilter} />}
      {tab === "revenue" && <RevenueReport branchId={branchFilter} />}
    </>
  );
}
