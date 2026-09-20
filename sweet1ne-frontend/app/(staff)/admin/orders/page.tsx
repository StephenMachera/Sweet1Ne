"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { OrderSummary } from "@/components/orders/order-summary";

type OrderItem = {
  id: string;
  menu_item_id: string;
  menu_item_title: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at?: string;
};

type Order = {
  id: string;
  table_id: string;
  table_number: number | null;
  branch_id: string | null;
  branch_name: string | null;
  seat_number: number | null;
  status: string;
  special_request: string | null;
  total_amount: number;
  created_at: string;
  placed_by_staff_id: string | null;
  placed_by_name: string | null;
  order_items: OrderItem[];
};

type Branch = { id: string; name: string; settings?: { toast?: string } };

type Channel = "all" | "collection" | "table";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

// Dark, monochrome-plus-gold equivalents of the light STATUS_STYLES —
// same statuses, same meaning, just matching the rest of the admin theme
// instead of introducing colors (red/green/etc) that don't exist there.
const STATUS_STYLES: Record<string, string> = {
  pending: "border border-[var(--gold-line)] text-[var(--gold)]",
  in_progress: "bg-[var(--gold)] text-[#0e0e0e]",
  ready: "border border-[var(--gold)] text-[var(--gold)]",
  completed: "text-[var(--ivory-dim)]",
  cancelled: "text-[var(--ivory-dim)] line-through",
};

const PERIODS = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This week" },
  { key: "monthly", label: "This month" },
  { key: "yearly", label: "This year" },
  { key: "all", label: "All time" },
];

const STATUSES = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

function timeOf(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [period, setPeriod] = useState("daily");
  const [branchFilter, setBranchFilter] = useState("");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState<Channel>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canView = hasPermission(me, "view_orders");
  const canVoid = hasPermission(me, "void_orders");

  const load = useCallback(() => {
    const params = new URLSearchParams({ period });
    if (branchFilter) params.set("branch_id", branchFilter);
    if (status) params.set("status", status);

    setLoading(true);
    return apiFetch(`/staff/orders?${params.toString()}`)
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [period, branchFilter, status]);

  useEffect(() => {
    apiFetch("/branches").then(setBranches).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canView) {
      router.replace("/admin/dashboard");
      return;
    }
    load();
  }, [meLoading, me, canView, router, load]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const id = lookupId.trim();
    if (!id) return;
    setError(null);
    try {
      const found = await apiFetch(`/staff/orders?order_id=${encodeURIComponent(id)}`);
      if (!found?.length) {
        setError("No order with that number.");
        return;
      }
      setLookupResult(found[0]);
      setExpandedId(found[0].id);
    } catch {
      setError("Couldn't find that order.");
    }
  }

  async function voidOrder(order: Order) {
    setError(null);
    try {
      await apiFetch(`/staff/orders/${order.id}`, { method: "DELETE" });
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "cancelled" } : o))
      );
      if (lookupResult?.id === order.id) {
        setLookupResult({ ...lookupResult, status: "cancelled" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't void that order.");
    }
  }

  if (meLoading || !me || !canView) {
    return <p className="text-sm text-[var(--ivory-dim)]">Loading…</p>;
  }

  const visible = lookupResult ? [lookupResult] : orders;
  const liveCount = orders.filter((o) => o.status === "pending" || o.status === "in_progress" || o.status === "ready").length;

  function ordersTable(list: Order[]) {
    return (
      <div className="admin-data-panel">
        <table className="admin-sheet">
          <thead>
            <tr>
              <th>Time</th>
              <th>Restaurant</th>
              <th>Channel</th>
              <th>For</th>
              <th>Status</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>{list.map(renderOrder)}</tbody>
        </table>
      </div>
    );
  }

  function renderOrder(order: Order) {
    const expanded = expandedId === order.id;
    const closed = order.status === "completed" || order.status === "cancelled";

    return (
      <Fragment key={order.id}>
        <tr>
          <td className="admin-muted">{timeOf(order.created_at)}</td>
          <td className="admin-muted">{order.branch_name ?? "—"}</td>
          <td className="admin-muted">Table</td>
          <td>
            <span className="admin-name">
              {order.table_number ? `Table ${order.table_number}` : "Table"}
            </span>
            <div className="admin-muted">
              {order.placed_by_name ? order.placed_by_name : "QR order"}
            </div>
          </td>
          <td>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                STATUS_STYLES[order.status] ?? "text-[var(--ivory-dim)]"
              }`}
            >
              {order.status.replace("_", " ")}
            </span>
          </td>
          <td className="admin-price">{gbp.format(order.total_amount)}</td>
          <td>
            <button
              type="button"
              className="admin-edit"
              aria-label={expanded ? "Hide details" : "See more"}
              onClick={() => setExpandedId(expanded ? null : order.id)}
            >
              <ChevronDown size={16} className={`inline transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </td>
        </tr>
        {expanded && (
          <tr>
            <td colSpan={7} className="border-t border-[var(--gold-line)] bg-[#080808]">
              <p className="mb-3 font-mono text-[11px] text-[var(--ivory-dim)]">Order {order.id}</p>

              <ul className="space-y-2">
                {order.order_items.map((line) => (
                  <li key={line.id} className="flex items-center gap-3 text-sm">
                    <span className="w-6 shrink-0 tabular-nums text-[var(--ivory-dim)]">
                      {line.quantity}×
                    </span>
                    <span className="flex-1 truncate text-[var(--ivory)]">
                      {line.menu_item_title ?? "Item"}
                    </span>
                    <span className="tabular-nums text-[var(--ivory)]">{gbp.format(line.total_price)}</span>
                  </li>
                ))}
              </ul>

              {order.special_request && (
                <p className="mt-3 rounded-lg border border-[var(--gold-line)] px-3 py-2 text-sm text-[var(--gold)]">
                  {order.special_request}
                </p>
              )}

              {canVoid && !closed && (
                <button type="button" onClick={() => voidOrder(order)} className="admin-book mt-4">
                  Void order
                </button>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  return (
    <>
      <div className="admin-top">
        <div className="admin-places" role="group" aria-label="Branch">
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

      <h1>Orders</h1>
      <p className="admin-dek">
        {visible.length} ticket{visible.length === 1 ? "" : "s"}
        {visible.length === 200 && " (showing the most recent 200)"}
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <section className="admin-board tight" aria-label="Order sources">
        {channel !== "table" && (
          <article className="admin-card">
            <h2>Collection</h2>
            <p className="admin-stat admin-hold">Live</p>
            <p>Guests order on Toast. Tickets list here when the API is connected.</p>
            <div className="admin-acts">
              {branches
                .filter((b) => (!branchFilter || branchFilter === b.id) && b.settings?.toast)
                .map((b) => (
                  <a key={b.id} className="admin-book" href={b.settings!.toast} target="_blank" rel="noopener">
                    {b.name} Toast
                  </a>
                ))}
            </div>
          </article>
        )}
        {channel !== "collection" && (
          <article className="admin-card">
            <h2>Table</h2>
            <p className="admin-stat">{liveCount}</p>
            <p>Guests scan the table&rsquo;s QR code, or a waiter places the order for them.</p>
            <Link className="admin-act" href="/admin/qr">
              QR Codes
            </Link>
          </article>
        )}
      </section>

      <div className="admin-cats is-spread" role="group" aria-label="Channel">
        <button type="button" className={channel === "all" ? "is-on" : undefined} onClick={() => setChannel("all")}>
          All
        </button>
        <button
          type="button"
          className={channel === "collection" ? "is-on" : undefined}
          onClick={() => setChannel("collection")}
        >
          Collection
        </button>
        <button
          type="button"
          className={channel === "table" ? "is-on" : undefined}
          onClick={() => setChannel("table")}
        >
          Table
        </button>
      </div>

      {channel === "collection" ? (
        <p className="admin-empty">
          Collection tickets aren&rsquo;t in this system yet — open Toast above to see them.
        </p>
      ) : (
        <>
          <form onSubmit={lookup} className="admin-tools">
            <input
              className="flex-1"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Look up an order by number…"
            />
            <button type="submit" className="admin-book">
              Find
            </button>
            {lookupResult && (
              <button
                type="button"
                className="admin-book"
                onClick={() => {
                  setLookupResult(null);
                  setLookupId("");
                  setExpandedId(null);
                }}
              >
                Clear
              </button>
            )}
          </form>

          {lookupResult ? (
            <>
              <p className="admin-dek">Showing one order — clear the search to go back.</p>
              {ordersTable([lookupResult])}
            </>
          ) : (
            <>
              <div className="admin-cats is-spread" role="group" aria-label="Period">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={period === p.key ? "is-on" : undefined}
                    onClick={() => setPeriod(p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {orders.length > 0 && <OrderSummary orders={orders} tone="admin" />}

              <div className="admin-cats is-spread" role="group" aria-label="Status">
                {STATUSES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={status === s.key ? "is-on" : undefined}
                    onClick={() => setStatus(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <p className="text-sm text-[var(--ivory-dim)]">Loading…</p>
              ) : visible.length === 0 ? (
                <p className="admin-empty">No orders match these filters.</p>
              ) : (
                ordersTable(visible)
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
