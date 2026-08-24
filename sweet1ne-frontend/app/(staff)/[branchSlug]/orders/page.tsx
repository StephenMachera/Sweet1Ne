"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Plus, ReceiptText, Search, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { MenuBrowser, type CartLine } from "@/components/menu/menu-browser";
import { OrderLineEditor } from "@/components/orders/order-line-editor";
import { OrderSummary } from "@/components/orders/order-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  seat_number: number | null;
  status: string;
  special_request: string | null;
  total_amount: number;
  created_at: string;
  placed_by_staff_id: string | null;
  placed_by_name: string | null;
  order_items: OrderItem[];
};

type Table = { id: string; number: number; region: string | null };

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning-bg text-warning",
  in_progress: "bg-info-bg text-info",
  ready: "bg-purple-bg text-purple",
  completed: "bg-success-bg text-success",
  cancelled: "bg-danger-bg text-danger",
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

export default function BranchOrdersPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [period, setPeriod] = useState("daily");
  const [status, setStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<Order | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const canView = hasPermission(me, "view_orders");
  const canAdd = hasPermission(me, "place_orders");
  const canEdit = hasPermission(me, "edit_orders");
  const seesEverything = hasPermission(me, "view_all_orders");

  const load = useCallback(() => {
    const params = new URLSearchParams({ period });
    if (status) params.set("status", status);

    setLoading(true);
    return apiFetch(`/staff/orders?${params.toString()}`)
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [period, status]);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canView) {
      router.replace(`/${branchSlug}/menu`);
      return;
    }
    load();
    // Today's view is live; historical periods don't need refreshing.
    if (period !== "daily") return;
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [meLoading, me, canView, branchSlug, router, load, period]);

  useEffect(() => {
    if (!canAdd) return;
    apiFetch("/tables").then(setTables).catch(() => setTables([]));
  }, [canAdd]);

  const fetcher = useCallback((path: string) => apiFetch(`/staff/menu${path}`), []);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const id = lookupId.trim();
    if (!id) return;

    setLookingUp(true);
    setError(null);
    setLookupResult(null);
    try {
      const found = await apiFetch(`/staff/orders?order_id=${encodeURIComponent(id)}`);
      if (!found || found.length === 0) {
        setError("No order with that number at this branch.");
        return;
      }
      setLookupResult(found[0]);
      setExpandedId(found[0].id);
    } catch {
      setError("Couldn't find that order. Check the number and try again.");
    } finally {
      setLookingUp(false);
    }
  }

  async function addItems(lines: CartLine[]) {
    if (!addingTo) return;
    const updated = await apiFetch(`/staff/orders/${addingTo.id}/items`, {
      method: "POST",
      body: JSON.stringify({ items: lines }),
    });
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    if (lookupResult?.id === updated.id) setLookupResult(updated);
    setAddingTo(null);
    setNotice("Items added to the order.");
    setTimeout(() => setNotice(null), 4000);
  }

  if (meLoading || !me || !canView) {
    return <p className="text-sm text-slate-muted">Loading…</p>;
  }

  const tableLabel = (order: Order) =>
    order.table_number
      ? `Table ${order.table_number}`
      : tables.find((t) => t.id === order.table_id)
        ? `Table ${tables.find((t) => t.id === order.table_id)!.number}`
        : "Table";

  const visible = lookupResult ? [lookupResult] : orders;

  function renderOrder(order: Order) {
    const expanded = expandedId === order.id;
    const closed = order.status === "completed" || order.status === "cancelled";
    const firstItemAt = order.order_items[0]?.created_at;

    return (
      <li
        key={order.id}
        className="overflow-hidden rounded-xl border border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      >
        <button
          onClick={() => setExpandedId(expanded ? null : order.id)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-navy">{tableLabel(order)}</span>
              {order.seat_number && (
                <span className="text-sm text-slate-muted">Seat {order.seat_number}</span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                  STATUS_STYLES[order.status] ?? "bg-slate-bg text-slate-subtle"
                }`}
              >
                {order.status.replace("_", " ")}
              </span>
              {!order.placed_by_staff_id && (
                <span className="rounded-full bg-purple-bg px-2 py-0.5 text-[11px] text-purple">
                  QR order
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-slate-muted">
              {timeOf(order.created_at)}
              {order.placed_by_name ? <> · {order.placed_by_name}</> : <> · customer</>}
              {" · "}
              {order.order_items.length} item{order.order_items.length === 1 ? "" : "s"}
            </p>
          </div>

          <span className="shrink-0 font-semibold tabular-nums text-navy">
            {gbp.format(order.total_amount)}
          </span>
          <ChevronDown
            size={17}
            className={`shrink-0 text-slate-muted transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {expanded && (
          <div className="border-t border-slate-bg bg-slate-bg/30 px-4 py-4 sm:px-5">
            <p className="mb-3 font-mono text-[11px] text-slate-muted">Order {order.id}</p>

            {editingId === order.id ? (
              <OrderLineEditor
                order={order}
                onSaved={(updated) => {
                  setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
                  if (lookupResult?.id === updated.id) setLookupResult(updated);
                  setEditingId(null);
                  setNotice("Order updated.");
                  setTimeout(() => setNotice(null), 4000);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <ul className="space-y-2">
                  {order.order_items.map((line) => {
                    const addedLater =
                      firstItemAt &&
                      line.created_at &&
                      new Date(line.created_at).getTime() - new Date(firstItemAt).getTime() >
                        60000;

                    return (
                      <li key={line.id} className="flex items-center gap-3 text-sm">
                        <span className="w-6 shrink-0 tabular-nums text-slate-muted">
                          {line.quantity}×
                        </span>
                        <span className="flex-1 truncate text-body">
                          {line.menu_item_title ?? "Item"}
                          {addedLater && (
                            <span className="ml-2 rounded-full bg-info-bg px-2 py-0.5 text-[11px] text-info">
                              added later
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums text-navy">
                          {gbp.format(line.total_price)}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {order.special_request && (
                  <p className="mt-3 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
                    {order.special_request}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {canEdit && order.status === "pending" && (
                    <Button
                      variant="outline"
                      onClick={() => setEditingId(order.id)}
                      className="border-slate-border text-slate-subtle"
                    >
                      <Pencil size={15} className="mr-1.5" />
                      Edit order
                    </Button>
                  )}

                  {canAdd && !closed && (
                    <Button
                      onClick={() => setAddingTo(order)}
                      className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
                    >
                      <Plus size={15} className="mr-1.5" />
                      Add items
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy sm:text-3xl">Orders</h1>
        <p className="mt-1 text-sm text-slate-subtle">
          {visible.length} {visible.length === 1 ? "order" : "orders"}
          {!seesEverything && !lookupResult && <> · yours and QR orders</>}
          {visible.length === 200 && " (showing the most recent 200)"}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-success/25 bg-success-bg px-4 py-3 text-sm text-success">
          {notice}
        </div>
      )}

      {/* Order lookup */}
      <form
        onSubmit={lookup}
        className="flex flex-col gap-2 rounded-xl border border-slate-bg bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted"
          />
          <Input
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="Look up an order by number…"
            className="h-10 border-slate-border pl-9 font-mono text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={lookingUp}
            className="h-10 flex-1 bg-navy text-white hover:bg-navy/90 sm:flex-none"
          >
            {lookingUp ? "Finding…" : "Find"}
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
              className="h-10 text-slate-subtle"
            >
              <X size={16} />
            </Button>
          )}
        </div>
      </form>

      {lookupResult ? (
        <>
          <p className="text-sm text-slate-subtle">
            Showing one order — clear the search to go back.
          </p>
          <ul className="space-y-3">{renderOrder(lookupResult)}</ul>
        </>
      ) : (
        <>
          {/* Period tabs */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  period === p.key
                    ? "bg-gradient-to-br from-emerald to-emerald-dark text-white shadow-sm"
                    : "border border-slate-border bg-white text-slate-subtle hover:text-navy"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Summary */}
          {orders.length > 0 && <OrderSummary orders={orders} tone="branch" />}

          {/* Status pills */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                onClick={() => setStatus(s.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  status === s.key
                    ? "bg-navy text-white"
                    : "border border-slate-border bg-white text-slate-subtle hover:text-navy"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-slate-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-border bg-white/50 px-6 py-16 text-center">
              <ReceiptText size={26} className="mx-auto text-slate-muted" />
              <p className="mt-3 text-sm text-slate-muted">No orders here.</p>
            </div>
          ) : (
            <ul className="space-y-3">{visible.map(renderOrder)}</ul>
          )}
        </>
      )}

      <Dialog open={addingTo !== null} onOpenChange={(open) => !open && setAddingTo(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-navy">
              Add to {addingTo && tableLabel(addingTo)}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-subtle">
            These go on the same bill. Existing items can't be changed once the kitchen has
            started.
          </p>
          <MenuBrowser
            mode="ordering"
            fetcher={fetcher}
            onSubmitOrder={addItems}
            submitLabel="Add to order"
            compact
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}