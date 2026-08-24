"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Clock, LogOut, Printer, Undo2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useMe, hasPermission } from "@/lib/use-me";
import { useStationRealtime } from "@/lib/use-station-realtime";
import { useAnnouncer, SoundControls } from "@/components/kitchen/announcer";

type StationItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item_title: string | null;
  quantity: number;
  status: string;
  created_at: string;
};

type StationOrder = {
  order_id: string;
  table_number: number | null;
  region: string | null;
  seat_number: number | null;
  special_request: string | null;
  order_status: string;
  placed_by_name: string | null;
  created_at: string;
  items: StationItem[];
  allergen_tags: string[];
};

export type StationLabels = {
  arrived: string;
  active: string;
  activeAction: string;
  done: string;
};

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

/** Escalation by wait time — a stalled order should be visible without reading clocks. */
function urgency(minutes: number) {
  if (minutes >= 20) return { ring: "ring-2 ring-danger", text: "text-danger" };
  if (minutes >= 10) return { ring: "ring-2 ring-warning", text: "text-warning" };
  return { ring: "", text: "text-slate-muted" };
}

export function StationScreen({
  station,
  title,
  icon: Icon,
  accessPermission,
  branchSlug,
  labels,
}: {
  station: string;
  title: string;
  icon: any;
  accessPermission: string;
  branchSlug: string;
  labels: StationLabels;
}) {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const { announce, enabled, toggle, needsUnlock, unlock } = useAnnouncer();

  const [orders, setOrders] = useState<StationOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const canAdvance = hasPermission(me, "update_order_status");
  const canAccess = hasPermission(me, accessPermission);

  // Snapshot of the previous fetch, so the next one can work out what to
  // announce rather than repeating everything on screen.
  const previous = useRef<Map<string, StationOrder>>(new Map());

  const load = useCallback(async () => {
    try {
      const data: StationOrder[] = await apiFetch(`/station/${station}/orders`);

      const seen = previous.current;
      for (const order of data) {
        const before = seen.get(order.order_id);
        const where = order.table_number
          ? `table ${order.table_number}${order.region ? `, ${order.region}` : ""}`
          : "a table";

        if (!before) {
          // Skip the very first load — nobody wants every open order read out.
          if (seen.size > 0) {
            announce(`new-${order.order_id}`, `New order from ${where}.`);
          }
        } else if (order.items.length > before.items.length) {
          const added = order.items.length - before.items.length;
          announce(
            `added-${order.order_id}-${order.items.length}`,
            `${added} item${added === 1 ? "" : "s"} added to ${where}.`,
            true
          );
        }
      }

      for (const [id, before] of seen) {
        if (!data.find((o) => o.order_id === id) && before.order_status === "pending") {
          const where = before.table_number ? `table ${before.table_number}` : "a table";
          announce(`cancelled-${id}`, `Order for ${where} was cancelled.`, true);
        }
      }

      previous.current = new Map(data.map((o) => [o.order_id, o]));
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load orders.");
    } finally {
      setLoading(false);
    }
  }, [announce, station]);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canAccess) {
      router.replace("/login");
      return;
    }
    load();
  }, [meLoading, me, canAccess, router, load]);

  // Realtime is a signal, not the data — any change means refetch the
  // station-shaped payload, which the raw row can't provide.
  useStationRealtime(() => {
    load();
  });

  // Re-render every 30s so wait times and urgency colours stay honest.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  async function advance(order: StationOrder, status: string) {
    setBusy(order.order_id);
    setError(null);
    try {
      await apiFetch(`/station/orders/${order.order_id}/status?station=${station}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update that order.");
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  if (meLoading || !me || !canAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-bg">
        <p className="text-sm text-slate-muted">Loading…</p>
      </div>
    );
  }

  /** This station's progress on an order — its own items only. */
  const stationStatus = (order: StationOrder) => {
    const statuses = order.items.map((i) => i.status);
    if (statuses.every((s) => s === "served")) return "served";
    if (statuses.every((s) => s === "ready" || s === "served")) return "ready";
    if (statuses.some((s) => s === "in_progress")) return "in_progress";
    return "pending";
  };

  const arrived = orders.filter((o) => stationStatus(o) === "pending");
  const active = orders.filter((o) => stationStatus(o) === "in_progress");
  const done = orders.filter((o) => ["ready", "served"].includes(stationStatus(o)));

  return (
    <div className="min-h-screen bg-slate-bg">
      {/* Slim header — no sidebar on a station screen */}
      <header className="sticky top-0 z-20 border-b border-slate-border bg-white">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-white">
            <Icon size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight text-navy">{title}</p>
            <p className="truncate text-xs text-slate-muted">
              {me.full_name ?? me.email} · {branchSlug}
            </p>
          </div>

          <SoundControls
            enabled={enabled}
            onToggle={toggle}
            needsUnlock={needsUnlock}
            onUnlock={unlock}
          />

          <button
            onClick={logout}
            aria-label="Log out"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-border text-slate-muted hover:text-navy"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-muted">Loading orders…</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <Column title={labels.arrived} count={arrived.length} accent="bg-warning">
              {arrived.length === 0 ? (
                <Empty text="Nothing waiting." />
              ) : (
                arrived.map((order) => (
                  <OrderCard
                    key={order.order_id}
                    order={order}
                    busy={busy === order.order_id}
                    action={
                      canAdvance
                        ? { label: "Accept order", onClick: () => advance(order, "in_progress") }
                        : undefined
                    }
                  />
                ))
              )}
            </Column>

            <Column title={labels.active} count={active.length} accent="bg-info">
              {active.length === 0 ? (
                <Empty text="Nothing in progress." />
              ) : (
                active.map((order) => (
                  <OrderCard
                    key={order.order_id}
                    order={order}
                    busy={busy === order.order_id}
                    action={
                      canAdvance
                        ? { label: labels.activeAction, onClick: () => advance(order, "ready") }
                        : undefined
                    }
                    onUndo={canAdvance ? () => advance(order, "pending") : undefined}
                  />
                ))
              )}
            </Column>

            <Column title={labels.done} count={done.length} accent="bg-success">
              {done.length === 0 ? (
                <Empty text="Nothing ready yet." />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-bg bg-white">
                  <ul className="divide-y divide-slate-bg">
                    {done.map((order) => {
                      const isServed = stationStatus(order) === "served";
                      return (
                        <li key={order.order_id} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex-1 text-sm font-medium text-navy">
                              Table {order.table_number ?? "—"}
                              {order.seat_number && (
                                <span className="ml-1.5 text-xs font-normal text-slate-muted">
                                  seat {order.seat_number}
                                </span>
                              )}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                isServed
                                  ? "bg-slate-bg text-slate-subtle"
                                  : "bg-success-bg text-success"
                              }`}
                            >
                              {isServed ? "Collected" : "Ready"}
                            </span>
                          </div>

                          <p className="mt-1 truncate text-xs text-slate-muted">
                            {order.items
                              .map((i) => `${i.quantity}× ${i.menu_item_title}`)
                              .join(", ")}
                          </p>

                          <div className="mt-2 flex gap-2">
                            {!isServed && canAdvance && (
                              <button
                                onClick={() => advance(order, "served")}
                                disabled={busy === order.order_id}
                                className="rounded-lg bg-emerald px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                              >
                                Mark collected
                              </button>
                            )}
                            <button
                              onClick={() => window.print()}
                              className="flex items-center gap-1.5 rounded-lg border border-slate-border px-3 py-1.5 text-xs text-slate-muted"
                            >
                              <Printer size={13} />
                              Print
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Column>
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Column({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accent}`} />
        <h2 className="font-semibold text-navy">{title}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-subtle">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-border bg-white/50 px-4 py-10 text-center">
      <p className="text-sm text-slate-muted">{text}</p>
    </div>
  );
}

function OrderCard({
  order,
  busy,
  action,
  onUndo,
}: {
  order: StationOrder;
  busy: boolean;
  action?: { label: string; onClick: () => void };
  onUndo?: () => void;
}) {
  const waited = minutesSince(order.created_at);
  const { ring, text } = urgency(waited);

  return (
    <div className={`rounded-xl border border-slate-bg bg-white p-4 ${ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl text-navy">Table {order.table_number ?? "—"}</p>
          <p className="mt-0.5 text-xs text-slate-muted">
            {order.region && `${order.region} · `}
            {order.seat_number && `Seat ${order.seat_number} · `}
            {order.placed_by_name ?? "customer"}
          </p>
        </div>
        <span className={`flex shrink-0 items-center gap-1 text-sm font-medium ${text}`}>
          <Clock size={14} />
          {waited}m
        </span>
      </div>

      {order.allergen_tags.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" />
          <p className="text-sm font-medium capitalize text-danger">
            {order.allergen_tags.map((t) => t.replace(/_/g, " ")).join(", ")}
          </p>
        </div>
      )}

      <ul className="mt-3 space-y-1.5">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-baseline gap-3">
            <span className="w-7 shrink-0 text-lg font-semibold tabular-nums text-navy">
              {item.quantity}×
            </span>
            <span className="flex-1 text-[15px] text-body">{item.menu_item_title ?? "Item"}</span>
          </li>
        ))}
      </ul>

      {order.special_request && (
        <p className="mt-3 rounded-lg bg-warning-bg px-3 py-2 text-sm font-medium text-warning">
          {order.special_request}
        </p>
      )}

      {(action || onUndo) && (
        <div className="mt-4 flex gap-2">
          {action && (
            <button
              onClick={action.onClick}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald to-emerald-dark py-3.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Check size={16} />
              {busy ? "Working…" : action.label}
            </button>
          )}
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={busy}
              aria-label="Move back"
              className="flex h-[46px] w-[46px] items-center justify-center rounded-xl border border-slate-border text-slate-muted disabled:opacity-60"
            >
              <Undo2 size={17} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}