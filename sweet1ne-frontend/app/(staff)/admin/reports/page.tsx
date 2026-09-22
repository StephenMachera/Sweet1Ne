"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { ReportView } from "@/components/reports/report-view";
import { GeneralReport } from "@/components/reports/general-report";
import { AdminLoading } from "@/components/admin/admin-loading";

export default function AdminReportsPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const canView = hasPermission(me, "access_reports");

  const [tab, setTab] = useState<"general" | "revenue">("general");

  useEffect(() => {
    if (loading || !me) return;
    if (!canView) router.replace("/admin/dashboard");
  }, [me, loading, canView, router]);

  if (loading || !me || !canView) {
    return <AdminLoading />;
  }

  return (
    <>
      <div className="admin-top">
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Reports</h1>
      <p className="admin-dek">
        What filled the floor. One ID per promotion or mail — the same ID on the Google, Meta and
        Instagram tags. Booked and sat wait for SevenRooms and Toast.
      </p>

      <div className="admin-cats" role="group" aria-label="View">
        <button type="button" className={tab === "general" ? "is-on" : undefined} onClick={() => setTab("general")}>
          General
        </button>
        <button type="button" className={tab === "revenue" ? "is-on" : undefined} onClick={() => setTab("revenue")}>
          Revenue reports
        </button>
      </div>

      {tab === "general" ? (
        <GeneralReport />
      ) : (
        <ReportView
          title="Revenue reports"
          showBranchComparison
          hideHeader
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
