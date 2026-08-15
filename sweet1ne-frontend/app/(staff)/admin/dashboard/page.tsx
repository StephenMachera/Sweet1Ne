"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";

type BranchStats = {
  branch_id: string;
  branch_name: string;
  orders_today: number;
  revenue_today: number;
  live_orders: number;
  average_order_value: number;
};

type TopItem = {
  menu_item_id: string;
  title: string;
  total_quantity: number;
};

type Overview = {
  orders_today: number;
  revenue_today: number;
  live_orders: number;
  average_order_value: number;
  by_branch: BranchStats[];
  top_items: TopItem[];
};

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const gbpPrecise = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

function KpiCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-ink/8 bg-white p-5 shadow-[0_1px_2px_rgba(20,24,28,0.04)]">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p
        className={`mt-3 font-mono text-3xl tabular-nums ${accent ? "text-gold" : "text-ink"}`}
      >
        {value}
      </p>
      <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#F7F8FA]" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-ink/8 bg-white p-5">
      <div className="h-3 w-20 animate-pulse rounded bg-ink/8" />
      <div className="mt-4 h-8 w-24 animate-pulse rounded bg-ink/8" />
    </div>
  );
}

export default function DashboardPage() {
  const { me } = useMe();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      apiFetch("/reports/overview")
        .then(setData)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink max-md:hidden">Overview</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {today}
            {me?.full_name && <> · {me.full_name}</>}
          </p>
        </div>
        {data && data.live_orders > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs text-ink">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
            </span>
            {data.live_orders} order{data.live_orders === 1 ? "" : "s"} in progress
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-ember/25 bg-ember/5 px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : data ? (
          <>
            <KpiCard label="Orders today" value={String(data.orders_today)} />
            <KpiCard label="Revenue today" value={gbp.format(data.revenue_today)} accent />
            <KpiCard label="Live now" value={String(data.live_orders)} />
            <KpiCard
              label="Average order"
              value={gbpPrecise.format(data.average_order_value)}
            />
          </>
        ) : null}
      </section>

      {/* Branch breakdown + top items */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="overflow-hidden rounded-lg border border-ink/8 bg-white">
          <div className="border-b border-ink/8 px-5 py-4">
            <h2 className="font-display text-lg text-ink">By branch</h2>
          </div>

          {data && data.by_branch.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/8 text-left text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                    <th className="px-5 py-3 font-normal">Branch</th>
                    <th className="px-5 py-3 text-right font-normal">Orders</th>
                    <th className="px-5 py-3 text-right font-normal">Revenue</th>
                    <th className="px-5 py-3 text-right font-normal">Live</th>
                    <th className="px-5 py-3 text-right font-normal">Avg.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_branch.map((b) => (
                    <tr
                      key={b.branch_id}
                      className="border-b border-ink/5 last:border-0 hover:bg-ink/[0.015]"
                    >
                      <td className="px-5 py-3.5 text-ink">{b.branch_name}</td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-ink">
                        {b.orders_today}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-ink">
                        {gbp.format(b.revenue_today)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {b.live_orders > 0 ? (
                          <span className="font-mono tabular-nums text-gold">{b.live_orders}</span>
                        ) : (
                          <span className="font-mono tabular-nums text-ink-muted">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-ink-muted">
                        {gbpPrecise.format(b.average_order_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">
              {loading ? "Loading…" : "No orders yet today."}
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-ink/8 bg-white">
          <div className="border-b border-ink/8 px-5 py-4">
            <h2 className="font-display text-lg text-ink">Top selling today</h2>
          </div>

          {data && data.top_items.length > 0 ? (
            <ol className="divide-y divide-ink/5">
              {data.top_items.map((item, i) => (
                <li key={item.menu_item_id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="font-mono text-xs text-ink-muted">{i + 1}</span>
                  <span className="flex-1 truncate text-sm text-ink">{item.title}</span>
                  <span className="font-mono text-sm tabular-nums text-ink">
                    {item.total_quantity}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">
              {loading ? "Loading…" : "Nothing sold yet today."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}