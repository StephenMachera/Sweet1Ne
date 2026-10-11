"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission, landingPath } from "@/lib/use-me";
import { AdminLoading } from "@/components/admin/admin-loading";

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

function Stat({ value, wait = false }: { value: number | string | null; wait?: boolean }) {
  if (value === null) {
    return <p className={`admin-stat${wait ? " admin-hold" : ""}`}>—</p>;
  }
  return <p className="admin-stat">{value}</p>;
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
    return (
      <div className="admin-shell flex min-h-[60vh] items-center justify-center bg-[var(--bg)]">
        <AdminLoading />
      </div>
    );
  }

  const openOrders = orders.filter((o) => o.status === "pending" || o.status === "in_progress");

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="admin-shell admin-stage">
      <h1>Today</h1>
      <p className="admin-dek">
        {today}
        {me?.full_name && <> · {me.full_name}</>}
        {canSeeOrders && openOrders.length > 0 && <> · {openOrders.length} open</>}
      </p>

      {error && <p className="admin-hold">{error}</p>}

      <div className="admin-board-group">
        <section className="admin-board admin-board-stats" aria-label="Today">
          <article className="admin-card">
            <h2>Orders today</h2>
            <Stat value={loading && !data ? null : data!.orders_today} wait={loading && !data} />
          </article>
          <article className="admin-card">
            <h2>Revenue today</h2>
            <Stat
              value={loading && !data ? null : gbp.format(data!.revenue_today)}
              wait={loading && !data}
            />
          </article>
          <article className="admin-card">
            <h2>Live now</h2>
            <Stat value={loading && !data ? null : data!.live_orders} wait={loading && !data} />
          </article>
          <article className="admin-card">
            <h2>Average order</h2>
            <Stat
              value={loading && !data ? null : gbpPrecise.format(data!.average_order_value)}
              wait={loading && !data}
            />
          </article>
        </section>
      </div>

      <div className="admin-board-group">
        <section className={`admin-board ${canSeeOrders ? "" : "tight"}`} aria-label="Detail">
          {canSeeOrders && (
            <article className="admin-card" style={{ gridColumn: "span 2", minHeight: "auto" }}>
              <h2>Open orders{openOrders.length > 0 ? ` · ${openOrders.length}` : ""}</h2>
              {openOrders.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-0 p-0">
                  {openOrders.map((order) => {
                    const waiting = minutesSince(order.created_at);
                    const overdue = waiting > 15;
                    return (
                      <li
                        key={order.id}
                        className="flex items-center gap-4 border-b py-3 last:border-b-0"
                        style={{ borderColor: "var(--gold-line)" }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="m-0 text-sm" style={{ color: "var(--ivory)" }}>
                            {order.seat_number ? `Seat ${order.seat_number}` : "Table order"}
                          </p>
                          <p
                            className="m-0 mt-1 text-[0.68rem] uppercase tracking-[0.12em]"
                            style={{ color: "var(--ivory-dim)" }}
                          >
                            {order.status.replace("_", " ")}
                          </p>
                        </div>
                        <span
                          className="text-sm tabular-nums"
                          style={{ color: overdue ? "var(--gold)" : "var(--ivory-dim)" }}
                        >
                          {waiting}m
                        </span>
                        <span className="text-sm font-medium tabular-nums" style={{ color: "var(--ivory)" }}>
                          {gbpPrecise.format(order.total_amount)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>{loading ? "Loading…" : "Nothing open right now."}</p>
              )}
            </article>
          )}

          <article className="admin-card" style={{ minHeight: "auto" }}>
            <h2>Top selling today</h2>
            {data && data.top_items.length > 0 ? (
              <ol className="m-0 flex list-none flex-col gap-0 p-0">
                {data.top_items.map((item, i) => (
                  <li
                    key={item.menu_item_id}
                    className="flex items-center gap-3 border-b py-3 last:border-b-0"
                    style={{ borderColor: "var(--gold-line)" }}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-semibold"
                      style={{ color: "var(--gold)", border: "1px solid var(--gold-line)" }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm" style={{ color: "var(--ivory)" }}>
                      {item.title}
                    </span>
                    <span className="text-sm font-medium tabular-nums" style={{ color: "var(--ivory)" }}>
                      {item.total_quantity}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>{loading ? "Loading…" : "Nothing sold yet today."}</p>
            )}
          </article>
        </section>
      </div>
    </div>
  );
}
