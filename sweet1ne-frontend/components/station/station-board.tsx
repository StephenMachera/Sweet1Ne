"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Clock, Printer, Undo2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useStationRealtime } from "@/lib/use-station-realtime";
import type { StationLabels } from "@/components/station/station-screen";

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

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function urgency(minutes: number) {
  if (minutes >= 20) return "text-[#e08a8a]";
  if (minutes >= 10) return "text-[var(--gold)]";
  return "text-[var(--ivory-dim)]";
}

/**
 * The admin (all-branches) ticket board — same data and actions as the
 * branch-level kiosk (components/station/station-screen.tsx), reused via
 * the real GET /station/{station}/orders + PATCH .../status endpoints, but
 * rendered as plain tab content inside .admin-shell rather than a
 * standalone full-screen kiosk (no header/logout/sound-announcer — those
 * only make sense on a dedicated kitchen tablet, not an admin dashboard
 * tab). station-screen.tsx itself is untouched.
 */
export function StationBoard({
  station,
  branchId,
  labels,
  canAdvance,
}: {
  station: string;
  branchId: string;
  labels: StationLabels;
  canAdvance: boolean;
}) {
  const [orders, setOrders] = useState<StationOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const previous = useRef<Map<string, StationOrder>>(new Map());

  const load = useCallback(async () => {
    try {
      const query = branchId ? `?branch_id=${branchId}` : "";
      const data: StationOrder[] = await apiFetch(`/station/${station}/orders${query}`);
      previous.current = new Map(data.map((o) => [o.order_id, o]));
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load orders.");
    } finally {
      setLoading(false);
    }
  }, [station, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  useStationRealtime(() => {
    load();
  });

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
    <>
      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--ivory-dim)]">Loading orders…</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Column title={labels.arrived} count={arrived.length}>
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

          <Column title={labels.active} count={active.length}>
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

          <Column title={labels.done} count={done.length}>
            {done.length === 0 ? (
              <Empty text="Nothing ready yet." />
            ) : (
              <div className="admin-data-panel">
                <ul className="divide-y divide-[rgba(229,226,225,0.08)]">
                  {done.map((order) => {
                    const isServed = stationStatus(order) === "served";
                    return (
                      <li key={order.order_id} className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex-1 text-sm font-medium text-[var(--ivory)]">
                            Table {order.table_number ?? "—"}
                            {order.seat_number && (
                              <span className="ml-1.5 text-xs font-normal text-[var(--ivory-dim)]">
                                seat {order.seat_number}
                              </span>
                            )}
                          </span>
                          <span className={isServed ? "admin-status" : "admin-status is-ok"}>
                            {isServed ? "Collected" : "Ready"}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-xs text-[var(--ivory-dim)]">
                          {order.items.map((i) => `${i.quantity}× ${i.menu_item_title}`).join(", ")}
                        </p>

                        <div className="mt-2 flex gap-2">
                          {!isServed && canAdvance && (
                            <button
                              type="button"
                              className="admin-book"
                              onClick={() => advance(order, "served")}
                              disabled={busy === order.order_id}
                            >
                              Mark collected
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-edit"
                            onClick={() => window.print()}
                          >
                            <Printer size={13} className="mr-1 inline" />
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
    </>
  );
}

function Column({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-lg text-[var(--ivory)]">{title}</h2>
        <span className="admin-status">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-[3px] border border-dashed border-[var(--gold-line)] px-4 py-10 text-center">
      <p className="text-sm text-[var(--ivory-dim)]">{text}</p>
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
  const waitColor = urgency(waited);

  return (
    <div className="rounded-[3px] border border-[var(--gold-line)] bg-[var(--panel)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl text-[var(--ivory)]">
            Table {order.table_number ?? "—"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--ivory-dim)]">
            {order.region && `${order.region} · `}
            {order.seat_number && `Seat ${order.seat_number} · `}
            {order.placed_by_name ?? "customer"}
          </p>
        </div>
        <span className={`flex shrink-0 items-center gap-1 text-sm font-medium ${waitColor}`}>
          <Clock size={14} />
          {waited}m
        </span>
      </div>

      {order.allergen_tags.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-[3px] border border-[rgba(224,138,138,0.35)] bg-[rgba(224,138,138,0.08)] px-3 py-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#e08a8a]" />
          <p className="text-sm font-medium capitalize text-[#e08a8a]">
            {order.allergen_tags.map((t) => t.replace(/_/g, " ")).join(", ")}
          </p>
        </div>
      )}

      <ul className="mt-3 space-y-1.5">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-baseline gap-3">
            <span className="w-7 shrink-0 text-lg font-semibold tabular-nums text-[var(--ivory)]">
              {item.quantity}×
            </span>
            <span className="flex-1 text-[15px] text-[var(--ivory-dim)]">
              {item.menu_item_title ?? "Item"}
            </span>
          </li>
        ))}
      </ul>

      {order.special_request && (
        <p className="mt-3 rounded-[3px] border border-[var(--gold-line)] bg-[rgba(201,162,74,0.08)] px-3 py-2 text-sm font-medium text-[var(--gold)]">
          {order.special_request}
        </p>
      )}

      {(action || onUndo) && (
        <div className="mt-4 flex gap-2">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              disabled={busy}
              className="admin-book flex flex-1 items-center justify-center gap-2 !py-3.5 disabled:opacity-60"
            >
              <Check size={16} className="inline" />
              {busy ? "Working…" : action.label}
            </button>
          )}
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              disabled={busy}
              aria-label="Move back"
              className="admin-edit flex h-[46px] w-[46px] items-center justify-center rounded-[3px] border border-[var(--gold-line)] disabled:opacity-60"
            >
              <Undo2 size={17} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
