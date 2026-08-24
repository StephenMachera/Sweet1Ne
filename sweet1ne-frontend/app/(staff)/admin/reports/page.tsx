"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { ReportView } from "@/components/reports/report-view";

export default function AdminReportsPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const canView = hasPermission(me, "access_reports");

  useEffect(() => {
    if (loading || !me) return;
    if (!canView) router.replace("/admin/dashboard");
  }, [me, loading, canView, router]);

  if (loading || !me || !canView) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  return (
    <ReportView
      title="Reports"
      showBranchComparison
      palette={{
        accent: "#D4A853",
        accentSoft: "#FBF3E3",
        text: "text-ink",
        muted: "text-ink-muted",
        card: "bg-white",
        border: "border-ink/8",
        activeTab: "bg-ink text-paper",
        inactiveTab: "border border-ink/12 bg-white text-ink-muted hover:text-ink",
        positive: "text-sage",
        negative: "text-ember",
        series: ["#D4A853", "#6B7F5E", "#2F7D7F", "#6B5B95", "#C1502E", "#B8496B"],
      }}
    />
  );
}