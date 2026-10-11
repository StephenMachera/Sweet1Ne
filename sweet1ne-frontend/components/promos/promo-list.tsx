"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { PromoForm, type Promo } from "./promo-form";
import { AdminLoading } from "@/components/admin/admin-loading";

type Option = { id: string; name: string };

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function windowLabel(promo: Promo) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  if (promo.starts_at && promo.ends_at) return `${fmt(promo.starts_at)} – ${fmt(promo.ends_at)}`;
  if (promo.ends_at) return `until ${fmt(promo.ends_at)}`;
  if (promo.starts_at) return `from ${fmt(promo.starts_at)}`;
  return "no end date";
}

function isLive(promo: Promo) {
  if (!promo.is_active) return false;
  const now = Date.now();
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) return false;
  if (promo.ends_at && new Date(promo.ends_at).getTime() < now) return false;
  return true;
}

export function PromoList({
  tone,
  showBranchPicker,
}: {
  tone: "admin" | "branch";
  showBranchPicker: boolean;
}) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Promo | undefined>();
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

  // tone is kept on the prop for every caller — branch and admin now share
  // the one .admin-* look below, so it's no longer read here.
  void tone;

  const load = useCallback(
    () =>
      apiFetch("/promos")
        .then(setPromos)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
    if (showBranchPicker) {
      apiFetch("/branches")
        .then((list) => setBranches(list.map((b: any) => ({ id: b.id, name: b.name }))))
        .catch(() => setBranches([]));
    }
  }, [load, showBranchPicker]);

  async function remove(promo: Promo) {
    setError(null);
    try {
      await apiFetch(`/promos/${promo.id}`, { method: "DELETE" });
      setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, is_active: false } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that promotion.");
    }
  }

  async function reactivate(promo: Promo) {
    setError(null);
    try {
      const updated = await apiFetch(`/promos/${promo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: true }),
      });
      setPromos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reactivate that promotion.");
    }
  }

  const live = promos.filter(isLive);

  return (
    <>
      <p className="admin-dek">
        Discounts on real menu items, sub-categories or a whole category — automatic and shown
        right on the menu, unless a code is set, which only unlocks it for a guest who types it in.
        {" "}{live.length} live of {promos.length}.
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <div className="admin-tools">
        <button
          type="button"
          className="admin-book"
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          New discount
        </button>
      </div>

      {loading ? (
        <AdminLoading />
      ) : promos.length === 0 ? (
        <p className="admin-empty">No discounts yet. Create one to discount an item, a sub-category, or a whole category.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {promos.map((promo) => {
            const running = isLive(promo);
            return (
              <article key={promo.id} className={running ? "admin-card" : "admin-card is-wait"}>
                <h2>{promo.title}</h2>
                <p className="admin-stat">
                  {promo.discount_type === "percentage"
                    ? `${promo.discount_percent}% off`
                    : gbp.format(promo.fixed_price ?? 0)}
                </p>
                {promo.description && <p>{promo.description}</p>}
                <p className="text-[var(--ivory-dim)]">
                  {promo.target_name ?? "—"} · {windowLabel(promo)}
                  {promo.code && ` · Code ${promo.code}`}
                  {showBranchPicker &&
                    ` · ${promo.branch_id ? branches.find((b) => b.id === promo.branch_id)?.name ?? "one branch" : "All branches"}`}
                </p>
                <p className="admin-status" style={{ marginTop: "0.4rem" }}>
                  {promo.is_active ? (running ? "Live" : "Scheduled") : "Off"}
                </p>
                <div className="admin-row-acts" style={{ marginTop: "0.6rem" }}>
                  <button
                    type="button"
                    className="admin-edit"
                    onClick={() => {
                      setEditing(promo);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  {promo.is_active ? (
                    <button type="button" className="admin-edit" onClick={() => remove(promo)}>
                      Turn off
                    </button>
                  ) : (
                    <button type="button" className="admin-edit" onClick={() => reactivate(promo)}>
                      Turn back on
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {formOpen &&
        drawerSlot &&
        createPortal(
          <aside className="admin-drawer-edit is-builder">
            <h2>{editing ? "Edit discount" : "New discount"}</h2>
            <p className="admin-dek">Customers see this reflected in the real price on the menu.</p>
            <PromoForm
              promo={editing}
              branches={showBranchPicker ? branches : undefined}
              tone={tone}
              onSaved={(saved) => {
                setPromos((prev) =>
                  editing ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]
                );
                setFormOpen(false);
                setEditing(undefined);
              }}
              onCancel={() => {
                setFormOpen(false);
                setEditing(undefined);
              }}
            />
          </aside>,
          drawerSlot
        )}
    </>
  );
}