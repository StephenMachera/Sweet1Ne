"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { ReportView } from "@/components/reports/report-view";

export default function BranchReportsPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading } = useMe();
  const canView = hasPermission(me, "access_reports");

  useEffect(() => {
    if (loading || !me) return;
    if (!canView) router.replace(`/${branchSlug}/dashboard`);
  }, [me, loading, canView, branchSlug, router]);

  if (loading || !me || !canView) {
    return <p className="text-sm text-slate-muted">Loading…</p>;
  }

  return (
    <ReportView
      title="Reports"
      showBranchComparison={false}
      palette={{
        accent: "#10B981",
        accentSoft: "#D1FAE5",
        text: "text-navy",
        muted: "text-slate-muted",
        card: "bg-white",
        border: "border-slate-bg",
        activeTab: "bg-gradient-to-br from-emerald to-emerald-dark text-white",
        inactiveTab: "border border-slate-border bg-white text-slate-subtle hover:text-navy",
        positive: "text-success",
        negative: "text-danger",
        series: ["#10B981", "#2563EB", "#CA8A04", "#7C3AED", "#DC2626", "#16A34A"],
      }}
    />
  );
}