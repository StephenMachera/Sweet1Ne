"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { SubscriberList } from "@/components/campaigns/marketing/subscriber-list";
import { CampaignsPane } from "@/components/campaigns/marketing/campaigns-pane";
import { AdminLoading } from "@/components/admin/admin-loading";

export default function AdminMarketingPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const canManage = hasPermission(me, "manage_marketing");
  // Campaigns are company-wide, so branch-scoped staff can see the list but
  // not the Campaigns tab — same restriction the old /campaigns route had.
  const isUnscoped = me?.branch_id === null;

  const [view, setView] = useState<"list" | "campaigns">("list");

  useEffect(() => {
    if (loading || !me) return;
    if (!canManage) router.replace("/admin/dashboard");
  }, [me, loading, canManage, router]);

  if (loading || !me || !canManage) {
    return <AdminLoading />;
  }

  return (
    <>
      <div className="admin-top">
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Marketing</h1>
      <p className="admin-dek">Everyone who&rsquo;s agreed to hear from Sweet1NE</p>

      <div className="admin-cats" role="group" aria-label="View">
        <button type="button" className={view === "list" ? "is-on" : undefined} onClick={() => setView("list")}>
          List
        </button>
        {isUnscoped && (
          <button
            type="button"
            className={view === "campaigns" ? "is-on" : undefined}
            onClick={() => setView("campaigns")}
          >
            Campaigns
          </button>
        )}
      </div>

      {view === "list" ? (
        <SubscriberList tone="admin" canSendCampaigns={isUnscoped} hideHeader />
      ) : (
        <CampaignsPane />
      )}
    </>
  );
}
