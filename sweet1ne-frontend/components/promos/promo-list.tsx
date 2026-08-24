"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PromoForm, type Promo } from "./promo-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  const isBranch = tone === "branch";

  const card = isBranch
    ? "border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    : "border-ink/8 bg-white shadow-[0_1px_3px_rgba(20,24,28,0.04)]";
  const text = isBranch ? "text-navy" : "text-ink";
  const muted = isBranch ? "text-slate-muted" : "text-ink-muted";
  const primary = isBranch
    ? "bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
    : "bg-gold text-ink hover:bg-gold/90";
  const liveBadge = isBranch ? "bg-success-bg text-success" : "bg-sage-soft text-sage";
  const dormantBadge = isBranch ? "bg-slate-bg text-slate-subtle" : "bg-ink/5 text-ink-muted";
  const dangerHover = isBranch
    ? "hover:bg-danger-bg hover:text-danger"
    : "hover:bg-ember-soft hover:text-ember";
  const editHover = isBranch
    ? "hover:bg-info-bg hover:text-info"
    : "hover:bg-teal-soft hover:text-teal";

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={`text-2xl font-semibold sm:text-3xl ${text}`}>Promotions</h1>
          <p className={`mt-1 text-sm ${muted}`}>
            {live.length} live of {promos.length}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
          className={primary}
        >
          <Plus size={16} className="mr-1.5" />
          New promotion
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className={`rounded-xl px-4 py-3 text-sm ${
            isBranch
              ? "border border-danger/25 bg-danger-bg text-danger"
              : "border border-ember/25 bg-ember-soft text-ember"
          }`}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className={`text-sm ${muted}`}>Loading…</p>
      ) : promos.length === 0 ? (
        <div
          className={`rounded-xl border border-dashed px-6 py-16 text-center ${
            isBranch ? "border-slate-border" : "border-ink/15"
          }`}
        >
          <Tag size={26} className={`mx-auto ${muted}`} />
          <p className={`mt-3 text-sm ${muted}`}>
            No promotions yet. Create one to discount an item or a whole category.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {promos.map((promo) => {
            const running = isLive(promo);
            return (
              <li key={promo.id} className={`rounded-xl border p-5 ${card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className={`font-medium ${text}`}>{promo.title}</h3>
                    {promo.description && (
                      <p className={`mt-0.5 text-sm ${muted}`}>{promo.description}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      running ? liveBadge : dormantBadge
                    }`}
                  >
                    {promo.is_active ? (running ? "Live" : "Scheduled") : "Off"}
                  </span>
                </div>

                <p className={`mt-4 text-2xl font-semibold ${text}`}>
                  {promo.discount_type === "percentage"
                    ? `${promo.discount_percent}% off`
                    : gbp.format(promo.fixed_price ?? 0)}
                </p>

                <dl className={`mt-3 space-y-1 text-sm ${muted}`}>
                  <div className="flex gap-2">
                    <dt className="shrink-0">Applies to</dt>
                    <dd className={`truncate ${text}`}>{promo.target_name ?? "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">When</dt>
                    <dd>{windowLabel(promo)}</dd>
                  </div>
                  {showBranchPicker && (
                    <div className="flex gap-2">
                      <dt className="shrink-0">Where</dt>
                      <dd>
                        {promo.branch_id
                          ? branches.find((b) => b.id === promo.branch_id)?.name ?? "one branch"
                          : "All branches"}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-4 flex gap-1">
                  <button
                    onClick={() => {
                      setEditing(promo);
                      setFormOpen(true);
                    }}
                    aria-label="Edit"
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${muted} ${editHover}`}
                  >
                    <Pencil size={15} />
                  </button>

                  {promo.is_active ? (
                    <button
                      onClick={() => remove(promo)}
                      aria-label="Turn off"
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${muted} ${dangerHover}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={() => reactivate(promo)}
                      className={`ml-auto text-sm underline underline-offset-4 ${
                        isBranch ? "text-success" : "text-sage"
                      }`}
                    >
                      Turn back on
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className={`text-xl font-semibold ${text}`}>
              {editing ? "Edit promotion" : "New promotion"}
            </DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}