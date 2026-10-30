"use client";

import { Fragment, use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Pencil, Plus, Volume2, VolumeX } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { useCurrentBranch } from "@/lib/use-current-branch";
import { useAnnouncer } from "@/components/kitchen/announcer";
import { MenuBrowser, type CartLine } from "@/components/menu/menu-browser";
import { OrderLineEditor } from "@/components/orders/order-line-editor";
import { OrderSummary } from "@/components/orders/order-summary";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminLoading } from "@/components/admin/admin-loading";

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
  is_read: boolean;
};

const AUTO_REFRESH_MS = 3000;

type Channel = "all" | "collection" | "table";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

// Dark, monochrome-plus-gold equivalents of the light STATUS_STYLES — same
// statuses, same meaning, just matching the rest of the admin theme instead
// of introducing colors that don't exist there.
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

export default function BranchOrdersPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const { branch, loading: branchLoading } = useCurrentBranch(branchSlug);
  const { announce, enabled, toggle, needsUnlock, unlock } = useAnnouncer();

  const [orders, setOrders] = useState<Order[]>([]);
  const [period, setPeriod] = useState("daily");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState<Channel>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<Order | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canView = hasPermission(me, "view_orders");
  const canAdd = hasPermission(me, "place_orders");
  const canEdit = hasPermission(me, "edit_orders");
  const canVoid = hasPermission(me, "void_orders");

  // Which pending orders have already been chimed for, independent of
  // whatever filter happens to be selected — switching status/period
  // shouldn't re-announce an order just because it's newly visible.
  const announced = useRef<Set<string>>(new Set());
  // The very first fetch seeds `announced` with whatever's already
  // sitting there instead of reading the whole backlog out loud.
  const firstLoad = useRef(true);

  // `silent` is set on the background poll so new orders just appear in
  // place, instead of the whole list flashing to a loading spinner every
  // few seconds.
  const load = useCallback(
    (silent = false) => {
      if (!branch) return;
      const params = new URLSearchParams({ period, branch_id: branch.id });
      if (status) params.set("status", status);

      if (!silent) setLoading(true);
      return apiFetch(`/staff/orders?${params.toString()}`)
        .then((data: Order[]) => {
          if (firstLoad.current) {
            data.forEach((o) => announced.current.add(o.id));
            firstLoad.current = false;
          } else {
            for (const order of data) {
              if (order.status !== "pending" || announced.current.has(order.id)) continue;
              announced.current.add(order.id);
              const where = order.table_number ? `table ${order.table_number}` : "a table";
              announce(`new-${order.id}`, `New order from ${where}.`);
            }
          }
          setOrders(data);
        })
        .catch((e) => setError(e.message))
        .finally(() => {
          if (!silent) setLoading(false);
        });
    },
    [branch, period, status, announce]
  );

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canView) {
      router.replace(`/${branchSlug}/dashboard`);
      return;
    }
    load();
    // New orders should show up on their own, not only when a filter is
    // touched — silent so it doesn't flash the whole list on every tick.
    const id = setInterval(() => load(true), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [meLoading, me, canView, branchSlug, router, load]);

  // This branch's own menu only — ordering from here shouldn't surface
  // another branch's dishes.
  const fetcher = useCallback(
    (path: string) => {
      if (!branch) return Promise.reject(new Error("No branch resolved."));
      const sep = path.includes("?") ? "&" : "?";
      return apiFetch(`/staff/menu${path}${sep}branch_id=${branch.id}`);
    },
    [branch]
  );

  async function setRead(order: Order, isRead: boolean) {
    try {
      const updated: Order = await apiFetch(`/staff/orders/${order.id}/read`, {
        method: "PATCH",
        body: JSON.stringify({ is_read: isRead }),
      });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (lookupResult?.id === updated.id) setLookupResult(updated);
    } catch {
      // Not worth surfacing an error banner for a read receipt — worst case
      // it's re-sent next time the row is opened.
    }
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const id = lookupId.trim();
    if (!id || !branch) return;
    setError(null);
    try {
      const found = await apiFetch(
        `/staff/orders?order_id=${encodeURIComponent(id)}&branch_id=${branch.id}`
      );
      if (!found?.length) {
        setError("No order with that number at this branch.");
        return;
      }
      setLookupResult(found[0]);
      setExpandedId(found[0].id);
      if (!found[0].is_read) setRead(found[0], true);
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

  if (meLoading || !me || !canView || branchLoading || !branch) {
    return <AdminLoading />;
  }

  const visible = lookupResult ? [lookupResult] : orders;
  const liveCount = orders.filter((o) => o.status === "pending" || o.status === "in_progress" || o.status === "ready").length;
  const unreadCount = orders.filter((o) => !o.is_read).length;

  function tableLabel(order: Order) {
    return order.table_number ? `Table ${order.table_number}` : "Table";
  }

  function ordersTable(list: Order[]) {
    return (
      <div className="admin-data-panel">
        <table className="admin-sheet">
          <thead>
            <tr>
              <th>Time</th>
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
    const unread = !order.is_read;
    const firstItemAt = order.order_items[0]?.created_at;

    function toggleExpand() {
      const next = expanded ? null : order.id;
      setExpandedId(next);
      if (next && unread) setRead(order, true);
    }

    return (
      <Fragment key={order.id}>
        <tr className={unread ? "is-unread" : undefined}>
          <td className="admin-muted">{timeOf(order.created_at)}</td>
          <td className="admin-muted">Table</td>
          <td>
            <span className="admin-name" style={unread ? { fontWeight: 700 } : undefined}>
              {unread && (
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#c9a24a",
                    marginRight: 7,
                  }}
                />
              )}
              {tableLabel(order)}
              {order.seat_number && (
                <span className="ml-1.5 font-normal">Seat {order.seat_number}</span>
              )}
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
              onClick={toggleExpand}
            >
              <ChevronDown size={16} className={`inline transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </td>
        </tr>
        {expanded && (
          <tr>
            <td colSpan={6} className="border-t border-[var(--gold-line)] bg-[#080808]">
              <p className="mb-3 font-mono text-[11px] text-[var(--ivory-dim)]">Order {order.id}</p>

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
                          <span className="w-6 shrink-0 tabular-nums text-[var(--ivory-dim)]">
                            {line.quantity}×
                          </span>
                          <span className="flex-1 truncate text-[var(--ivory)]">
                            {line.menu_item_title ?? "Item"}
                            {addedLater && (
                              <span className="ml-2 rounded-full border border-[var(--gold-line)] px-2 py-0.5 text-[11px] text-[var(--gold)]">
                                added later
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums text-[var(--ivory)]">
                            {gbp.format(line.total_price)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {order.special_request && (
                    <p className="mt-3 rounded-lg border border-[var(--gold-line)] px-3 py-2 text-sm text-[var(--gold)]">
                      {order.special_request}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {canEdit && order.status === "pending" && (
                      <button type="button" onClick={() => setEditingId(order.id)} className="admin-edit">
                        <Pencil size={14} className="mr-1 inline" />
                        Edit order
                      </button>
                    )}
                    {canAdd && !closed && (
                      <button type="button" onClick={() => setAddingTo(order)} className="admin-book">
                        <Plus size={14} className="mr-1 inline" />
                        Add items
                      </button>
                    )}
                    {canVoid && !closed && (
                      <button type="button" onClick={() => voidOrder(order)} className="admin-edit">
                        Void order
                      </button>
                    )}
                  </div>
                </>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="!mb-0">Orders</h1>
        <button
          type="button"
          className="admin-edit inline-flex items-center gap-1.5"
          onClick={needsUnlock ? unlock : toggle}
          aria-label={
            needsUnlock
              ? "Enable sound for new orders"
              : enabled
                ? "Mute new-order sound"
                : "Unmute new-order sound"
          }
        >
          {needsUnlock ? (
            <>
              <Volume2 size={14} />
              Enable sound
            </>
          ) : enabled ? (
            <Volume2 size={14} />
          ) : (
            <VolumeX size={14} />
          )}
        </button>
      </div>
      <p className="admin-dek">
        {unreadCount > 0 ? `${unreadCount} new · ` : ""}
        {visible.length} ticket{visible.length === 1 ? "" : "s"}
        {visible.length === 200 && " (showing the most recent 200)"}
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}
      {notice && <p className="admin-dek mb-3 text-sm">{notice}</p>}

      <section className="admin-board tight" aria-label="Order sources">
        {channel !== "table" && (
          <article className="admin-card">
            <h2>Collection</h2>
            <p className="admin-stat admin-hold">Live</p>
            <p>Guests order on Toast. Tickets list here when the API is connected.</p>
            <div className="admin-acts">
              {branch.settings?.toast && (
                <a className="admin-book" href={branch.settings.toast} target="_blank" rel="noopener">
                  {branch.name} Toast
                </a>
              )}
            </div>
          </article>
        )}
        {channel !== "collection" && (
          <article className="admin-card">
            <h2>Table</h2>
            <p className="admin-stat">{liveCount}</p>
            <p>Guests scan the table&rsquo;s QR code, or a waiter places the order for them.</p>
            <Link className="admin-act" href={`/${branchSlug}/qr`}>
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
                <AdminLoading />
              ) : visible.length === 0 ? (
                <p className="admin-empty">No orders match these filters.</p>
              ) : (
                ordersTable(visible)
              )}
            </>
          )}
        </>
      )}

      <Dialog open={addingTo !== null} onOpenChange={(open) => !open && setAddingTo(null)}>
        {/* admin-shell here too — Dialog portals to document.body, outside
           the layout's own admin-shell, so --gold/--ivory need their own
           scope. */}
        <DialogContent className="admin-shell max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto border border-[var(--gold-line)] bg-[var(--panel)] p-4 text-[var(--ivory)] sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[var(--ivory)]">
              Add to {addingTo && tableLabel(addingTo)}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--ivory-dim)]">
            These go on the same bill. Existing items can&apos;t be changed once the kitchen has
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
    </>
  );
}
