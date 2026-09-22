"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMe, hasPermission } from "@/lib/use-me";
import { apiFetch } from "@/lib/api";
import { StationBoard } from "@/components/station/station-board";
import type { StationLabels } from "@/components/station/station-screen";
import { EightySix } from "@/components/floor/eighty-six";
import { AdminLoading } from "@/components/admin/admin-loading";

type Branch = { id: string; name: string; settings?: { toast?: string } };

const CONFIG: Record<
  "kitchen" | "bar",
  { title: string; dek: string; eightyLabel: string; eightyCopy: string; labels: StationLabels }
> = {
  kitchen: {
    title: "Kitchen",
    dek: "Live tickets across every branch, and the pass's own 86 list.",
    eightyLabel: "86",
    eightyCopy: "Off the pass. Same list as Menu.",
    labels: { arrived: "Arrived", active: "Preparing", activeAction: "Ready to serve", done: "Ready & served" },
  },
  bar: {
    title: "Bar",
    dek: "Live tickets across every branch, and the bar's own 86 list.",
    eightyLabel: "86",
    eightyCopy: "Off the bar. Same list as Menu.",
    labels: { arrived: "Orders in", active: "Pouring", activeAction: "Ready to collect", done: "Ready & collected" },
  },
};

export function FloorAdminPage({ station }: { station: "kitchen" | "bar" }) {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const permission = station === "kitchen" ? "access_kitchen" : "access_bar";
  const canAccess = hasPermission(me, permission);
  const canAdvance = hasPermission(me, "update_order_status");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [view, setView] = useState<"tickets" | "eighty">("tickets");
  const [eightyCount, setEightyCount] = useState<number | null>(null);

  const config = CONFIG[station];

  useEffect(() => {
    apiFetch("/branches").then(setBranches).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canAccess) router.replace("/admin/dashboard");
  }, [meLoading, me, canAccess, router]);

  useEffect(() => {
    const scopeQuery = branchFilter ? `?branch_id=${branchFilter}&include_inactive=true` : "?include_inactive=true";
    Promise.all([
      apiFetch(`/staff/menu/main-categories${scopeQuery}`),
      apiFetch(`/staff/menu/sub-categories${scopeQuery}`),
      apiFetch(`/staff/menu/menu-items${scopeQuery}`),
    ])
      .then(([mains, subs, items]: [{ id: string; prep_station: string }[], { id: string; main_category_id: string }[], { sub_category_id: string; is_available: boolean }[]]) => {
        const stationMainIds = new Set(mains.filter((m) => m.prep_station === station).map((m) => m.id));
        const subById = new Map(subs.map((s) => [s.id, s]));
        const off = items.filter((item) => {
          const sub = subById.get(item.sub_category_id);
          return sub && stationMainIds.has(sub.main_category_id) && !item.is_available;
        });
        setEightyCount(off.length);
      })
      .catch(() => setEightyCount(null));
  }, [branchFilter, station]);

  if (meLoading || !me || !canAccess) {
    return <AdminLoading />;
  }

  return (
    <>
      <div className="admin-top">
        <div className="admin-places" role="group" aria-label="Restaurant">
          <button
            type="button"
            className={branchFilter === "" ? "is-on" : undefined}
            onClick={() => setBranchFilter("")}
          >
            All branches
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={branchFilter === b.id ? "is-on" : undefined}
              onClick={() => setBranchFilter(branchFilter === b.id ? "" : b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>{config.title}</h1>
      <p className="admin-dek">{config.dek}</p>

      <section className="admin-board tight" aria-label={config.title}>
        <article className="admin-card is-wait">
          <h2>Tickets</h2>
          <p className="admin-stat admin-hold">Live</p>
          <p>Real orders from the floor, not Toast — every branch shown here.</p>
          <div className="admin-acts">
            {branches
              .filter((b) => b.settings?.toast)
              .map((b) => (
                <a key={b.id} className="admin-act" href={b.settings!.toast} target="_blank" rel="noreferrer">
                  {b.name} Toast
                </a>
              ))}
          </div>
        </article>
        <article className="admin-card">
          <h2>{config.eightyLabel}</h2>
          <p className="admin-stat">{eightyCount ?? "—"}</p>
          <p>{config.eightyCopy}</p>
          <div className="admin-acts">
            <Link className="admin-act" href="/admin/menu/manage">
              Menu
            </Link>
          </div>
        </article>
      </section>

      <div className="admin-cats" role="group" aria-label="View">
        <button type="button" className={view === "tickets" ? "is-on" : undefined} onClick={() => setView("tickets")}>
          Tickets
        </button>
        <button type="button" className={view === "eighty" ? "is-on" : undefined} onClick={() => setView("eighty")}>
          {config.eightyLabel}
        </button>
      </div>

      {view === "tickets" ? (
        <StationBoard station={station} branchId={branchFilter} labels={config.labels} canAdvance={canAdvance} />
      ) : (
        <EightySix station={station} branchId={branchFilter} />
      )}
    </>
  );
}
