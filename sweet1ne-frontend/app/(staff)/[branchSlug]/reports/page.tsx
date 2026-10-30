"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { ReportView } from "@/components/reports/report-view";
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

  const [tab, setTab] = useState<"reports" | "insights">("reports");

  useEffect(() => {
    if (loading || !me) return;
    if (!canView) router.replace(`/${branchSlug}/dashboard`);
  }, [me, loading, canView, branchSlug, router]);

  if (loading || !me || !canView) {
    return <AdminLoading />;
  }

  return (
    <>
      <div className="admin-cats" role="group" aria-label="View">
        <button type="button" className={tab === "reports" ? "is-on" : undefined} onClick={() => setTab("reports")}>
          Reports
        </button>
        <button type="button" className={tab === "insights" ? "is-on" : undefined} onClick={() => setTab("insights")}>
          Insights
        </button>
      </div>

      {tab === "insights" ? (
        <p className="admin-empty">Insights — coming soon.</p>
      ) : (
        <ReportView
          title="Reports"
          showBranchComparison={false}
          palette={{
            accent: "#c9a24a",
            accentSoft: "rgba(201,162,74,0.12)",
            text: "text-[var(--ivory)]",
            muted: "text-[var(--ivory-dim)]",
            card: "bg-[var(--panel-2)]",
            border: "border-[var(--gold-line)]",
            activeTab: "bg-[var(--gold)] text-[#0e0e0e]",
            inactiveTab:
              "border border-[var(--gold-line)] bg-[var(--panel)] text-[var(--ivory-dim)] hover:text-[var(--ivory)]",
            positive: "text-[var(--gold)]",
            negative: "text-[var(--ivory-dim)]",
            series: ["#c9a24a", "#7c9473", "#4a8f91", "#8a7bab", "#b8724a", "#a15c78"],
          }}
        />
      )}
    </>
  );
}
