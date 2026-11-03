"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { GeneralReport } from "@/components/reports/general-report";
import { AdminLoading } from "@/components/admin/admin-loading";

export default function BranchReportsPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading } = useMe();
  const canView = hasPermission(me, "access_reports");

  const [tab, setTab] = useState<"general" | "revenue">("general");

  useEffect(() => {
    if (loading || !me) return;
    if (!canView) router.replace(`/${branchSlug}/dashboard`);
  }, [me, loading, canView, branchSlug, router]);

  if (loading || !me || !canView) {
    return <AdminLoading />;
  }

  return (
    <>
      <h1>Reports</h1>

      <div className="admin-cats" role="group" aria-label="View">
        <button type="button" className={tab === "general" ? "is-on" : undefined} onClick={() => setTab("general")}>
          General
        </button>
        <button type="button" className={tab === "revenue" ? "is-on" : undefined} onClick={() => setTab("revenue")}>
          Revenue reports
        </button>
      </div>

      {tab === "general" && <GeneralReport />}
    </>
  );
}
