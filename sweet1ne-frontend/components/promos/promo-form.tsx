"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type Promo = {
  id: string;
  branch_id: string | null;
  title: string;
  description: string | null;
  code: string | null;
  target_type: string;
  target_menu_item_id: string | null;
  target_sub_category_id: string | null;
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
  const [code, setCode] = useState(promo?.code ?? "");
  const [branchId, setBranchId] = useState(promo?.branch_id ?? "");
  const [targetType, setTargetType] = useState(promo?.target_type ?? "item");
  const [itemId, setItemId] = useState(promo?.target_menu_item_id ?? "");
  const [subCategoryId, setSubCategoryId] = useState(promo?.target_sub_category_id ?? "");
  const [categoryId, setCategoryId] = useState(promo?.target_main_category_id ?? "");
  const [discountType, setDiscountType] = useState(promo?.discount_type ?? "percentage");
  const [percent, setPercent] = useState(promo?.discount_percent?.toString() ?? "");
  const [fixedPrice, setFixedPrice] = useState(promo?.fixed_price?.toString() ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(promo?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(promo?.ends_at ?? null));

  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [subCategories, setSubCategories] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // tone is kept on the prop for every caller — branch and admin now share
  // the one .admin-form look, so it's no longer read here.
  void tone;

  useEffect(() => {
    Promise.all([
      apiFetch("/staff/menu/menu-items?include_inactive=true"),
      apiFetch("/staff/menu/sub-categories?include_inactive=true"),
      apiFetch("/staff/menu/main-categories?include_inactive=true"),
    ])
      .then(([itemList, subList, categoryList]) => {
        setItems(itemList.map((i: { id: string; title: string }) => ({ id: i.id, title: i.title })));
        setSubCategories(subList.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
        setCategories(categoryList.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
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
        code: code.trim() || null,
        target_type: targetType,
        target_menu_item_id: targetType === "item" ? itemId || null : null,
        target_sub_category_id: targetType === "sub_category" ? subCategoryId || null : null,
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
      <form onSubmit={handleSubmit} className="admin-form">
        <fieldset disabled={saving} className="contents">
          {error && (
            <p role="alert" className="admin-hold mb-3 text-sm">
              {error}
            </p>
          )}

          <label>
            Name
            <input
              required
              placeholder="e.g. Clearing the fridge"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label>
            Description
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <label>
            Code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Leave blank to always apply"
              autoComplete="off"
            />
            <span className="text-xs text-[var(--ivory-dim)]">
              Set one and this only applies when a guest types it in.
            </span>
          </label>

          {branches && !promo && (
            <label>
              Branch
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <p className="admin-kicker">What does this apply to?</p>
          <div className="admin-cats" role="group" aria-label="Applies to">
            <button type="button" className={targetType === "item" ? "is-on" : undefined} onClick={() => setTargetType("item")}>
              One item
            </button>
            <button
              type="button"
              className={targetType === "sub_category" ? "is-on" : undefined}
              onClick={() => setTargetType("sub_category")}
            >
              A sub-category
            </button>
            <button
              type="button"
              className={targetType === "category" ? "is-on" : undefined}
              onClick={() => setTargetType("category")}
            >
              A whole category
            </button>
          </div>

          {targetType === "item" ? (
            <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">Choose an item…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          ) : targetType === "sub_category" ? (
            <select value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)}>
              <option value="">Choose a sub-category…</option>
              {subCategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Choose a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <p className="admin-kicker">How much off?</p>
          <div className="admin-cats" role="group" aria-label="Discount type">
            <button
              type="button"
              className={discountType === "percentage" ? "is-on" : undefined}
              onClick={() => setDiscountType("percentage")}
            >
              Percentage off
            </button>
            <button
              type="button"
              className={discountType === "fixed_price" ? "is-on" : undefined}
              onClick={() => setDiscountType("fixed_price")}
            >
              Set a new price
            </button>
          </div>

          {discountType === "percentage" ? (
            <label>
              Percent off
              <input
                type="number"
                min="1"
                max="100"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
            </label>
          ) : (
            <label>
              Promotional price (£)
              <input
                type="number"
                step="0.01"
                min="0"
                value={fixedPrice}
                onChange={(e) => setFixedPrice(e.target.value)}
              />
              <span className="text-xs text-[var(--ivory-dim)]">
                Overrides any percentage discounts on the same item.
              </span>
            </label>
          )}

          <div className="admin-row">
            <label>
              Starts
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
              />
            </label>
            <label>
              Ends
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
              />
            </label>
          </div>
          <p className="text-xs text-[var(--ivory-dim)]" style={{ marginTop: "-0.5rem" }}>
            Leave either blank for no limit.
          </p>

          <div className="flex gap-3 pt-1">
            <button type="submit" className="admin-book" disabled={saving}>
              {saving ? "Saving…" : promo ? "Save changes" : "Create discount"}
            </button>
            <button type="button" className="admin-book" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
  );
}