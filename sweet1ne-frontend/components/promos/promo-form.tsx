"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Promo = {
  id: string;
  branch_id: string | null;
  title: string;
  description: string | null;
  target_type: string;
  target_menu_item_id: string | null;
  target_main_category_id: string | null;
  target_name: string | null;
  discount_type: string;
  discount_percent: number | null;
  fixed_price: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

type Option = { id: string; name: string };

/** datetime-local needs "YYYY-MM-DDTHH:mm", not a full ISO string. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PromoForm({
  promo,
  branches,
  tone,
  onSaved,
  onCancel,
}: {
  promo?: Promo;
  /** Omitted at branch level — a manager's own branch is used. */
  branches?: Option[];
  tone: "admin" | "branch";
  onSaved: (promo: Promo) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(promo?.title ?? "");
  const [description, setDescription] = useState(promo?.description ?? "");
  const [branchId, setBranchId] = useState(promo?.branch_id ?? "");
  const [targetType, setTargetType] = useState(promo?.target_type ?? "item");
  const [itemId, setItemId] = useState(promo?.target_menu_item_id ?? "");
  const [categoryId, setCategoryId] = useState(promo?.target_main_category_id ?? "");
  const [discountType, setDiscountType] = useState(promo?.discount_type ?? "percentage");
  const [percent, setPercent] = useState(promo?.discount_percent?.toString() ?? "");
  const [fixedPrice, setFixedPrice] = useState(promo?.fixed_price?.toString() ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(promo?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(promo?.ends_at ?? null));

  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBranch = tone === "branch";
  const primary = isBranch
    ? "bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
    : "bg-gold text-ink hover:bg-gold/90";
  const border = isBranch ? "border-slate-border" : "border-ink/15";
  const muted = isBranch ? "text-slate-muted" : "text-ink-muted";
  const errorBox = isBranch
    ? "border border-danger/25 bg-danger-bg text-danger"
    : "border border-ember/25 bg-ember-soft text-ember";

  useEffect(() => {
    Promise.all([
      apiFetch("/staff/menu/menu-items?include_inactive=true"),
      apiFetch("/staff/menu/main-categories?include_inactive=true"),
    ])
      .then(([itemList, categoryList]) => {
        setItems(itemList.map((i: any) => ({ id: i.id, title: i.title })));
        setCategories(categoryList.map((c: any) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const body = {
        title,
        description: description || null,
        target_type: targetType,
        target_menu_item_id: targetType === "item" ? itemId || null : null,
        target_main_category_id: targetType === "category" ? categoryId || null : null,
        discount_type: discountType,
        discount_percent: discountType === "percentage" ? Number(percent) : null,
        fixed_price: discountType === "fixed_price" ? Number(fixedPrice) : null,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        ...(branches && !promo ? { branch_id: branchId || null } : {}),
      };

      const saved = promo
        ? await apiFetch(`/promos/${promo.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/promos", { method: "POST", body: JSON.stringify(body) });

      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this promotion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={saving} className="space-y-5">
        {error && <div role="alert" className={`rounded-lg px-4 py-3 text-sm ${errorBox}`}>{error}</div>}

        <div className="space-y-1">
          <Label htmlFor="p-title">Name</Label>
          <Input
            id="p-title"
            required
            placeholder="e.g. Clearing the fridge"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={border}
          />
          <p className={`text-xs ${muted}`}>Customers see this on the menu.</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="p-desc">Description</Label>
          <Input
            id="p-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={border}
          />
        </div>

        {branches && !promo && (
          <div className="space-y-1">
            <Label htmlFor="p-branch">Branch</Label>
            <select
              id="p-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className={`h-10 w-full rounded-lg border bg-white px-3 text-sm ${border}`}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Target */}
        <div className={`space-y-3 rounded-lg border p-4 ${border}`}>
          <Label>What does this apply to?</Label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTargetType("item")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm ${
                targetType === "item"
                  ? isBranch
                    ? "bg-emerald/15 text-emerald-dark"
                    : "bg-gold-soft text-[#8a6a28]"
                  : `border ${border} ${muted}`
              }`}
            >
              One item
            </button>
            <button
              type="button"
              onClick={() => setTargetType("category")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm ${
                targetType === "category"
                  ? isBranch
                    ? "bg-emerald/15 text-emerald-dark"
                    : "bg-gold-soft text-[#8a6a28]"
                  : `border ${border} ${muted}`
              }`}
            >
              A whole category
            </button>
          </div>

          {targetType === "item" ? (
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className={`h-10 w-full rounded-lg border bg-white px-3 text-sm ${border}`}
            >
              <option value="">Choose an item…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`h-10 w-full rounded-lg border bg-white px-3 text-sm ${border}`}
            >
              <option value="">Choose a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Discount */}
        <div className={`space-y-3 rounded-lg border p-4 ${border}`}>
          <Label>How much off?</Label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDiscountType("percentage")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm ${
                discountType === "percentage"
                  ? isBranch
                    ? "bg-emerald/15 text-emerald-dark"
                    : "bg-gold-soft text-[#8a6a28]"
                  : `border ${border} ${muted}`
              }`}
            >
              Percentage off
            </button>
            <button
              type="button"
              onClick={() => setDiscountType("fixed_price")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm ${
                discountType === "fixed_price"
                  ? isBranch
                    ? "bg-emerald/15 text-emerald-dark"
                    : "bg-gold-soft text-[#8a6a28]"
                  : `border ${border} ${muted}`
              }`}
            >
              Set a new price
            </button>
          </div>

          {discountType === "percentage" ? (
            <div className="space-y-1">
              <Label htmlFor="p-percent">Percent off</Label>
              <Input
                id="p-percent"
                type="number"
                min="1"
                max="100"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className={border}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="p-price">Promotional price (£)</Label>
              <Input
                id="p-price"
                type="number"
                step="0.01"
                min="0"
                value={fixedPrice}
                onChange={(e) => setFixedPrice(e.target.value)}
                className={border}
              />
              <p className={`text-xs ${muted}`}>
                Overrides any percentage discounts on the same item.
              </p>
            </div>
          )}
        </div>

        {/* Window */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="p-start">Starts</Label>
            <Input
              id="p-start"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={border}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-end">Ends</Label>
            <Input
              id="p-end"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={border}
            />
          </div>
        </div>
        <p className={`-mt-2 text-xs ${muted}`}>Leave either blank for no limit.</p>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={saving} className={primary}>
            {saving ? "Saving…" : promo ? "Save changes" : "Create promotion"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  );
}