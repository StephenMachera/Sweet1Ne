"use client";

import { useState } from "react";
import { Check, Minus, Plus, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

type OrderItem = {
  id: string;
  menu_item_id: string;
  menu_item_title: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type Order = {
  id: string;
  seat_number: number | null;
  special_request: string | null;
  order_items: OrderItem[];
};

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function OrderLineEditor({
  order,
  onSaved,
  onCancel,
}: {
  order: Order;
  onSaved: (order: any) => void;
  onCancel: () => void;
}) {
  // Draft quantities keyed by menu_item_id — that's what the API expects
  // back, and it collapses duplicate lines for the same item naturally.
  const [draft, setDraft] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const line of order.order_items) {
      initial[line.menu_item_id] = (initial[line.menu_item_id] ?? 0) + line.quantity;
    }
    return initial;
  });

  const [specialRequest, setSpecialRequest] = useState(order.special_request ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleFor = (menuItemId: string) =>
    order.order_items.find((l) => l.menu_item_id === menuItemId)?.menu_item_title ?? "Item";

  const priceFor = (menuItemId: string) =>
    order.order_items.find((l) => l.menu_item_id === menuItemId)?.unit_price ?? 0;

  function change(menuItemId: string, delta: number) {
    setDraft((prev) => ({
      ...prev,
      [menuItemId]: Math.max(0, (prev[menuItemId] ?? 0) + delta),
    }));
  }

  function removeLine(menuItemId: string) {
    setDraft((prev) => ({ ...prev, [menuItemId]: 0 }));
  }

  const lines = Object.entries(draft);
  const remaining = lines.filter(([, qty]) => qty > 0);
  const total = remaining.reduce((sum, [id, qty]) => sum + priceFor(id) * qty, 0);

  async function save() {
    if (remaining.length === 0) {
      setError("An order needs at least one item. Cancel it instead if it's not wanted.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/staff/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          special_request: specialRequest || null,
          items: remaining.map(([menu_item_id, quantity]) => ({ menu_item_id, quantity })),
        }),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save those changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-info/25 bg-info-bg/30 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-info">Editing order</p>
        <button
          onClick={onCancel}
          aria-label="Stop editing"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-muted hover:bg-white hover:text-navy"
        >
          <X size={15} />
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-danger/25 bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <ul className="space-y-2">
        {lines.map(([menuItemId, qty]) => {
          const removed = qty === 0;
          return (
            <li
              key={menuItemId}
              className={`flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2.5 sm:flex-nowrap sm:gap-3 ${
                removed ? "opacity-50" : ""
              }`}
            >
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  removed ? "text-slate-muted line-through" : "text-body"
                }`}
              >
                {titleFor(menuItemId)}
              </span>

              {removed ? (
                <button
                  onClick={() => change(menuItemId, 1)}
                  className="text-xs text-emerald-dark underline underline-offset-4"
                >
                  Undo
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-border px-1.5 py-1">
                    <button
                      onClick={() => change(menuItemId, -1)}
                      aria-label="Remove one"
                      className="flex h-7 w-7 items-center justify-center rounded text-slate-subtle hover:bg-slate-bg"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-5 text-center text-sm font-medium tabular-nums text-navy">
                      {qty}
                    </span>
                    <button
                      onClick={() => change(menuItemId, 1)}
                      aria-label="Add one"
                      className="flex h-7 w-7 items-center justify-center rounded text-emerald-dark hover:bg-emerald/10"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <span className="w-16 text-right text-sm tabular-nums text-navy">
                    {gbp.format(priceFor(menuItemId) * qty)}
                  </span>

                  <button
                    onClick={() => removeLine(menuItemId)}
                    aria-label="Remove line"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-muted hover:bg-danger-bg hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 space-y-1">
        <label htmlFor={`sr-${order.id}`} className="text-xs text-slate-subtle">
          Special request
        </label>
        <input
          id={`sr-${order.id}`}
          value={specialRequest}
          onChange={(e) => setSpecialRequest(e.target.value)}
          className="h-10 w-full rounded-lg border border-slate-border bg-white px-3 text-sm"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-slate-subtle">
          New total{" "}
          <span className="font-semibold tabular-nums text-navy">{gbp.format(total)}</span>
        </span>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving} className="text-slate-subtle">
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
          >
            <Check size={15} className="mr-1.5" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}