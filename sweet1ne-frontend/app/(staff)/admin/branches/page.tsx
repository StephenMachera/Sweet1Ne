"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Phone, MapPin, Users, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { BranchForm, type Branch } from "@/components/staff/branch-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type BranchStats = {
  branch_id: string;
  branch_name: string;
  orders_today: number;
  revenue_today: number;
  live_orders: number;
  average_order_value: number;
};

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function BranchCard({ branch, stats }: { branch: Branch; stats?: BranchStats }) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink/8 bg-white shadow-[0_1px_2px_rgba(20,24,28,0.04)]">
      <div className="relative h-36 bg-ink-cool">
        {branch.image_url ? (
          <img src={branch.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-paper/25">
            <Building2 size={32} />
          </div>
        )}

        {!branch.is_active && (
          <span className="absolute right-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-xs text-paper">
            Inactive
          </span>
        )}

        {stats && stats.live_orders > 0 && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink/75 px-2.5 py-1 text-xs text-paper backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
            </span>
            {stats.live_orders} live
          </span>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-display text-lg text-ink">{branch.name}</h3>
        <p className="mt-0.5 font-mono text-xs text-ink-muted">sweet1ne.com/{branch.slug}</p>

        {/* Live figures */}
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-md border border-ink/8 bg-[#F7F8FA] px-3 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Orders</p>
            <p className="mt-1 font-mono text-lg tabular-nums text-ink">
              {stats ? stats.orders_today : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Revenue</p>
            <p className="mt-1 font-mono text-lg tabular-nums text-ink">
              {stats ? gbp.format(stats.revenue_today) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Live</p>
            <p
              className={`mt-1 font-mono text-lg tabular-nums ${
                stats && stats.live_orders > 0 ? "text-gold" : "text-ink"
              }`}
            >
              {stats ? stats.live_orders : "—"}
            </p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          {branch.address && (
            <div className="flex items-start gap-2.5 text-ink-muted">
              <MapPin size={15} className="mt-0.5 shrink-0" />
              <span>{branch.address}</span>
            </div>
          )}
          {branch.phone && (
            <div className="flex items-center gap-2.5 text-ink-muted">
              <Phone size={15} className="shrink-0" />
              <span>{branch.phone}</span>
            </div>
          )}
          {branch.capacity != null && (
            <div className="flex items-center gap-2.5 text-ink-muted">
              <Users size={15} className="shrink-0" />
              <span>Seats {branch.capacity}</span>
            </div>
          )}
        </dl>

        <Link
          href={`/${branch.slug}/dashboard`}
          className="mt-5 inline-block text-sm text-ink underline decoration-gold decoration-2 underline-offset-4 hover:text-ink/70"
        >
          Open branch dashboard
        </Link>
      </div>
    </div>
  );
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [statsByBranch, setStatsByBranch] = useState<Record<string, BranchStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch("/branches"), apiFetch("/reports/overview")])
      .then(([branchList, overview]) => {
        setBranches(branchList);
        setStatsByBranch(
          Object.fromEntries(
            overview.by_branch.map((s: BranchStats) => [s.branch_id, s])
          )
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink max-md:hidden">Branches</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {branches.length} {branches.length === 1 ? "location" : "locations"}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-gold text-ink hover:bg-gold/90">
          <Plus size={16} className="mr-1.5" />
          New branch
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-ember/25 bg-ember/5 px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : branches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 px-6 py-16 text-center">
          <Building2 size={28} className="mx-auto text-ink-muted" />
          <p className="mt-3 text-sm text-ink-muted">
            No branches yet. Create your first location to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => (
            <BranchCard key={branch.id} branch={branch} stats={statsByBranch[branch.id]} />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">New branch</DialogTitle>
          </DialogHeader>
          <BranchForm
            onCreated={(branch) => {
              setBranches((prev) => [...prev, branch]);
              setDialogOpen(false);
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}