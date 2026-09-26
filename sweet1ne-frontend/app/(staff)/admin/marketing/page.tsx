"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { SubscriberList } from "@/components/campaigns/marketing/subscriber-list";
import { CampaignsPane } from "@/components/campaigns/marketing/campaigns-pane";
import { AdminLoading } from "@/components/admin/admin-loading";

type Branch = { id: string; name: string };
type Stats = { subscribed: number; from_website: number; from_reservations: number; unsubscribed: number };

export default function AdminMarketingPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const canManage = hasPermission(me, "manage_marketing");
  // Campaigns are company-wide, so branch-scoped staff can see the list but
  // not the Campaigns tab — same restriction the old /campaigns route had.
  const isUnscoped = me?.branch_id === null;

  const [view, setView] = useState<"campaigns" | "list">("campaigns");
  const [placeFilter, setPlaceFilter] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const loadStats = useCallback(() => {
    apiFetch("/newsletter/stats").then(setStats).catch(() => setStats(null));
  }, []);

  useEffect(() => {
    apiFetch("/branches").then(setBranches).catch(() => setBranches([]));
    loadStats();
  }, [loadStats]);

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
        <div className="admin-places" role="group" aria-label="Restaurant">
          <button type="button" className={placeFilter === "" ? "is-on" : undefined} onClick={() => setPlaceFilter("")}>
            Both
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={placeFilter === b.id ? "is-on" : undefined}
              onClick={() => setPlaceFilter(placeFilter === b.id ? "" : b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Marketing</h1>
      <p className="admin-dek">
        Letters go to people who asked. First-party list only — no Meta leads. New names land on{" "}
        <Link href="/admin/leads">Leads</Link>.
      </p>

      <section className="admin-board admin-board-stats" aria-label="List">
        <article className="admin-card">
          <h2>On the list</h2>
          <p className="admin-stat">{stats?.subscribed ?? 0}</p>
        </article>
        <article className="admin-card">
          <h2>Website</h2>
          <p className="admin-stat">{stats?.from_website ?? 0}</p>
        </article>
        <article className="admin-card">
          <h2>Bookings</h2>
          <p className="admin-stat">{stats?.from_reservations ?? 0}</p>
        </article>
        <article className="admin-card">
          <h2>Opted out</h2>
          <p className="admin-stat">{stats?.unsubscribed ?? 0}</p>
        </article>
      </section>

      <div className="admin-cats" role="group" aria-label="View">
        {isUnscoped && (
          <button
            type="button"
            className={view === "campaigns" ? "is-on" : undefined}
            onClick={() => setView("campaigns")}
          >
            Campaigns
          </button>
        )}
        <button type="button" className={view === "list" ? "is-on" : undefined} onClick={() => setView("list")}>
          The list
        </button>
      </div>

      {view === "list" ? (
        <SubscriberList tone="admin" canSendCampaigns={isUnscoped} hideHeader onChanged={loadStats} />
      ) : (
        <CampaignsPane />
      )}
    </>
  );
}
