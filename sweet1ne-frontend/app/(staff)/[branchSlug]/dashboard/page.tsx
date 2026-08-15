"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Clock, ReceiptText, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission, landingPath } from "@/lib/use-me";

type Overview = {
  orders_today: number;
  revenue_today: number;
  live_orders: number;
  average_order_value: number;
  top_items: { menu_item_id: string; title: string; total_quantity: number }[];
};

type Order = {
  id: string;
  status: string;
  seat_number: number | null;
  total_amount: number;
  created_at: string;
};

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const gbpPrecise = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning-bg text-warning",
  in_progress: "bg-info-bg text-info",
  completed: "bg-success-bg text-success",
  cancelled: "bg-danger-bg text-danger",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-muted">{label}</p>
          <p className="mt-2.5 text-3xl font-semibold tabular-nums text-navy">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
    </Card>
  );
}

export default function BranchDashboardPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const [data, setData] = useState<Overview | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowed = hasPermission(me, "access_reports");
  const canSeeOrders = hasPermission(me, "view_orders");

  useEffect(() => {
    if (meLoading) return;
    if (!allowed) {
      router.replace(landingPath(me!));
      return;
    }

    const load = () => {
      const requests: Promise<any>[] = [apiFetch("/reports/overview")];
      if (canSeeOrders) requests.push(apiFetch("/staff/orders"));

      return Promise.all(requests)
        .then(([overview, orderList]) => {
          setData(overview);
          if (orderList) setOrders(orderList);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    };

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [meLoading, allowed, canSeeOrders, router]);

  if (meLoading || !allowed) {
    return <p className="text-sm text-slate-muted">Loading…</p>;
  }

  const openOrders = orders.filter((o) => o.status === "pending" || o.status === "in_progress");

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-navy max-md:hidden">Today</h1>
          <p className="mt-1 text-sm text-slate-subtle">
            {today}
            {me?.full_name && <> · {me.full_name}</>}
          </p>
        </div>

        {canSeeOrders && openOrders.length > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald/10 px-3.5 py-1.5 text-xs font-medium text-emerald-dark">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
            </span>
            {openOrders.length} open
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading || !data ? (
          [0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-bg" />
              <div className="mt-4 h-8 w-24 animate-pulse rounded bg-slate-bg" />
            </Card>
          ))
        ) : (
          <>
            <Kpi
              icon={ReceiptText}
              label="Orders today"
              value={String(data.orders_today)}
              tone="bg-info-bg text-info"
            />
            <Kpi
              icon={Banknote}
              label="Revenue today"
              value={gbp.format(data.revenue_today)}
              tone="bg-success-bg text-success"
            />
            <Kpi
              icon={Clock}
              label="Live now"
              value={String(data.live_orders)}
              tone="bg-warning-bg text-warning"
            />
            <Kpi
              icon={TrendingUp}
              label="Average order"
              value={gbpPrecise.format(data.average_order_value)}
              tone="bg-purple-bg text-purple"
            />
          </>
        )}
      </section>

      {/* Detail */}
      <div className={`grid gap-5 ${canSeeOrders ? "lg:grid-cols-[1.6fr_1fr]" : ""}`}>
        {canSeeOrders && (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-border px-5 py-4">
              <h2 className="font-semibold text-navy">Open orders</h2>
              {openOrders.length > 0 && (
                <span className="rounded-full bg-slate-bg px-2.5 py-0.5 text-xs text-slate-subtle">
                  {openOrders.length}
                </span>
              )}
            </div>

            {openOrders.length > 0 ? (
              <ul className="divide-y divide-slate-bg">
                {openOrders.map((order) => {
                  const waiting = minutesSince(order.created_at);
                  const overdue = waiting > 15;
                  return (
                    <li key={order.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-navy">
                          {order.seat_number ? `Seat ${order.seat_number}` : "Table order"}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                            STATUS_STYLES[order.status] ?? "bg-slate-bg text-slate-subtle"
                          }`}
                        >
                          {order.status.replace("_", " ")}
                        </span>
                      </div>
                      <span
                        className={`text-sm tabular-nums ${
                          overdue ? "font-medium text-danger" : "text-slate-muted"
                        }`}
                      >
                        {waiting}m
                      </span>
                      <span className="text-sm font-medium tabular-nums text-navy">
                        {gbpPrecise.format(order.total_amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-12 text-center text-sm text-slate-muted">
                {loading ? "Loading…" : "Nothing open right now."}
              </p>
            )}
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="border-b border-slate-border px-5 py-4">
            <h2 className="font-semibold text-navy">Top selling today</h2>
          </div>

          {data && data.top_items.length > 0 ? (
            <ol className="divide-y divide-slate-bg">
              {data.top_items.map((item, i) => (
                <li key={item.menu_item_id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald/10 text-xs font-semibold text-emerald-dark">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm text-body">{item.title}</span>
                  <span className="text-sm font-medium tabular-nums text-navy">
                    {item.total_quantity}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-12 text-center text-sm text-slate-muted">
              {loading ? "Loading…" : "Nothing sold yet today."}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}