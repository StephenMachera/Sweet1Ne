"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, ReceiptText, Search, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

type Branch = { id: string; name: string };

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gold-soft text-[#8a6a28]",
  in_progress: "bg-teal-soft text-teal",
  completed: "bg-sage-soft text-sage",
  cancelled: "bg-ember-soft text-ember",
};

const STATUSES = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
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
  const [branchFilter, setBranchFilter] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canView = hasPermission(me, "view_orders");
  const canVoid = hasPermission(me, "void_orders");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (branchFilter) params.set("branch_id", branchFilter);
    if (status) params.set("status", status);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);

    const qs = params.toString();
    setLoading(true);
    return apiFetch(`/staff/orders${qs ? `?${qs}` : ""}`)
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [branchFilter, status, dateFrom, dateTo]);

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
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  const visible = lookupResult ? [lookupResult] : orders;
  const revenue = visible
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total_amount, 0);

  function renderOrder(order: Order) {
    const expanded = expandedId === order.id;
    const closed = order.status === "completed" || order.status === "cancelled";

    return (
      <li
        key={order.id}
        className="overflow-hidden rounded-xl border border-ink/8 bg-white shadow-[0_1px_3px_rgba(20,24,28,0.04)]"
      >
        <button
          onClick={() => setExpandedId(expanded ? null : order.id)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-ink/[0.015] sm:px-5"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">
                {order.table_number ? `Table ${order.table_number}` : "Table"}
              </span>
              {order.branch_name && (
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink-muted">
                  {order.branch_name}
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                  STATUS_STYLES[order.status] ?? "bg-ink/5 text-ink-muted"
                }`}
              >
                {order.status.replace("_", " ")}
              </span>
              {!order.placed_by_staff_id && (
                <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[11px] text-violet">
                  QR order
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-ink-muted">
              {timeOf(order.created_at)}
              {order.placed_by_name ? <> · {order.placed_by_name}</> : <> · customer</>}
              {" · "}
              {order.order_items.length} item{order.order_items.length === 1 ? "" : "s"}
            </p>
          </div>

          <span className="shrink-0 font-semibold tabular-nums text-ink">
            {gbp.format(order.total_amount)}
          </span>
          <ChevronDown
            size={17}
            className={`shrink-0 text-ink-muted transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {expanded && (
          <div className="border-t border-ink/8 bg-[#FBFCFD] px-4 py-4 sm:px-5">
            <p className="mb-3 font-mono text-[11px] text-ink-muted">Order {order.id}</p>

            <ul className="space-y-2">
              {order.order_items.map((line) => (
                <li key={line.id} className="flex items-center gap-3 text-sm">
                  <span className="w-6 shrink-0 tabular-nums text-ink-muted">
                    {line.quantity}×
                  </span>
                  <span className="flex-1 truncate text-ink">
                    {line.menu_item_title ?? "Item"}
                  </span>
                  <span className="tabular-nums text-ink">{gbp.format(line.total_price)}</span>
                </li>
              ))}
            </ul>

            {order.special_request && (
              <p className="mt-3 rounded-lg bg-gold-soft px-3 py-2 text-sm text-[#8a6a28]">
                {order.special_request}
              </p>
            )}

            {canVoid && !closed && (
              <Button
                onClick={() => voidOrder(order)}
                className="mt-4 bg-ember-soft text-ember hover:bg-ember/15"
                size="sm"
              >
                Void order
              </Button>
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink max-md:hidden">Orders</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {visible.length} {visible.length === 1 ? "order" : "orders"} ·{" "}
            {gbp.format(revenue)}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-ember/25 bg-ember-soft px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      )}

      {/* Lookup */}
      <form
        onSubmit={lookup}
        className="flex flex-col gap-2 rounded-xl border border-ink/8 bg-white p-3 shadow-[0_1px_3px_rgba(20,24,28,0.04)] sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <Input
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="Look up an order by number…"
            className="h-10 pl-9 font-mono text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="h-10 flex-1 bg-ink text-paper hover:bg-ink/90 sm:flex-none">
            Find
          </Button>
          {lookupResult && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setLookupResult(null);
                setLookupId("");
                setExpandedId(null);
              }}
              className="h-10 text-ink-muted"
            >
              <X size={16} />
            </Button>
          )}
        </div>
      </form>

      {lookupResult ? (
        <>
          <p className="text-sm text-ink-muted">Showing one order — clear the search to go back.</p>
          <ul className="space-y-3">{renderOrder(lookupResult)}</ul>
        </>
      ) : (
        <>
          {/* Branch pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.14em] text-ink-muted">Branch</span>
            <button
              onClick={() => setBranchFilter("")}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                branchFilter === ""
                  ? "bg-ink text-paper"
                  : "border border-ink/12 bg-white text-ink-muted hover:text-ink"
              }`}
            >
              All branches
            </button>
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => setBranchFilter(branchFilter === b.id ? "" : b.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  branchFilter === b.id
                    ? "bg-ink text-paper"
                    : "border border-ink/12 bg-white text-ink-muted hover:text-ink"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>

          {/* Status + dates */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatus(s.key)}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                    status === s.key
                      ? "bg-gold text-ink"
                      : "border border-ink/12 bg-white text-ink-muted hover:text-ink"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="from" className="text-xs">
                  From
                </Label>
                <Input
                  id="from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to" className="text-xs">
                  To
                </Label>
                <Input
                  id="to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 bg-white"
                />
              </div>
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="h-9 text-ink-muted"
                >
                  <CalendarDays size={15} className="mr-1.5" />
                  Today only
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink/15 bg-white/50 px-6 py-16 text-center">
              <ReceiptText size={26} className="mx-auto text-ink-muted" />
              <p className="mt-3 text-sm text-ink-muted">No orders match these filters.</p>
            </div>
          ) : (
            <ul className="space-y-3">{visible.map(renderOrder)}</ul>
          )}
        </>
      )}
    </div>
  );
}