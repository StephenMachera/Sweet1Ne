"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { CategoryManager } from "@/components/menu/category-manager";
import { MenuItemForm } from "@/components/menu/menu-item-form";
import type { MainCategory, MenuItem, SubCategory } from "@/components/menu/menu-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

type Tab = "items" | "subs" | "mains";

export default function MenuManagePage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [tab, setTab] = useState<Tab>("items");
  const [mains, setMains] = useState<MainCategory[]>([]);
  const [subs, setSubs] = useState<SubCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [query, setQuery] = useState("");
  const [mainFilter, setMainFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<MenuItem | null>(null);

  const canEdit = hasPermission(me, "edit_menu");

  const load = useCallback(() => {
    return Promise.all([
      apiFetch("/staff/menu/main-categories?include_inactive=true"),
      apiFetch("/staff/menu/sub-categories?include_inactive=true"),
      apiFetch("/staff/menu/menu-items?include_inactive=true"),
    ])
      .then(([m, s, i]) => {
        setMains(m);
        setSubs(s);
        setItems(i);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canEdit) {
      router.replace(`/${branchSlug}/menu`);
      return;
    }
    load();
  }, [meLoading, me, canEdit, branchSlug, router, load]);

  async function remove(item: MenuItem) {
    setConfirmDelete(null);
    setError(null);
    try {
      await apiFetch(`/staff/menu/menu-items/${item.id}`, { method: "DELETE" });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: false } : i))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that item.");
    }
  }

  async function toggleAvailability(item: MenuItem) {
    setError(null);
    try {
      const updated = await apiFetch(`/staff/menu/menu-items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_available: !item.is_available }),
      });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update availability.");
    }
  }

  if (meLoading || !me || !canEdit) {
    return <p className="text-sm text-slate-muted">Loading…</p>;
  }

  const subById = new Map(subs.map((s) => [s.id, s]));
  const mainById = new Map(mains.map((m) => [m.id, m]));

  const visibleItems = items.filter((item) => {
    if (query) {
      const q = query.toLowerCase();
      if (
        !item.title.toLowerCase().includes(q) &&
        !(item.description ?? "").toLowerCase().includes(q)
      )
        return false;
    }
    if (mainFilter) {
      const sub = subById.get(item.sub_category_id);
      if (!sub || sub.main_category_id !== mainFilter) return false;
    }
    return true;
  });

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "items", label: "Items", count: items.length },
    { key: "subs", label: "Subcategories", count: subs.length },
    { key: "mains", label: "Main categories", count: mains.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-navy max-md:hidden">Menu</h1>
          <p className="mt-1 text-sm text-slate-subtle">
            {items.length} item{items.length === 1 ? "" : "s"} across {mains.length}{" "}
            categor{mains.length === 1 ? "y" : "ies"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${branchSlug}/menu/preview`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-border bg-white px-3.5 text-sm text-slate-subtle transition-colors hover:text-navy"
          >
            <Eye size={15} />
            Preview as customer
          </Link>
          {tab === "items" && (
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
              className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
            >
              <Plus size={16} className="mr-1.5" />
              Add item
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm transition-colors ${
              tab === t.key
                ? "font-medium text-emerald-dark"
                : "text-slate-muted hover:text-navy"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-slate-muted">{t.count}</span>
            {tab === t.key && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald" />
            )}
          </button>
        ))}
      </div>

      {tab === "mains" && (
        <CategoryManager level="main" mains={mains} subs={subs} onChanged={load} />
      )}
      {tab === "subs" && (
        <CategoryManager level="sub" mains={mains} subs={subs} onChanged={load} />
      )}

      {tab === "items" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items…"
                className="h-10 border-slate-border bg-white pl-9"
              />
            </div>
            <select
              value={mainFilter}
              onChange={(e) => setMainFilter(e.target.value)}
              className="h-10 rounded-lg border border-slate-border bg-white px-3 text-sm"
            >
              <option value="">All categories</option>
              {mains.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-slate-muted">Loading…</p>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-border bg-white/50 px-6 py-16 text-center">
              <p className="text-sm text-slate-muted">
                {items.length === 0
                  ? "No items yet. Add your first one to get started."
                  : "No items match these filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <div className="hidden border-b border-slate-border bg-slate-bg/50 px-5 py-3 text-[11px] uppercase tracking-[0.12em] text-slate-muted md:grid md:grid-cols-[1.6fr_1fr_100px_110px_90px] md:gap-4">
                <span>Item</span>
                <span>Category</span>
                <span className="text-right">Price</span>
                <span>Availability</span>
                <span className="text-right">Actions</span>
              </div>

              <ul className="divide-y divide-slate-bg">
                {visibleItems.map((item) => {
                  const sub = subById.get(item.sub_category_id);
                  const main = sub ? mainById.get(sub.main_category_id) : undefined;

                  return (
                    <li
                      key={item.id}
                      className="px-5 py-3.5 md:grid md:grid-cols-[1.6fr_1fr_100px_110px_90px] md:items-center md:gap-4"
                    >
                      <div className="flex items-center gap-3">
                        {item.picture ? (
                          <img
                            src={item.picture}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-bg text-[10px] text-slate-muted">
                            —
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-navy">{item.title}</p>
                          {item.description && (
                            <p className="truncate text-xs text-slate-muted">{item.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-md:mt-2 max-md:pl-13">
                        {main && (
                          <span className="rounded-full bg-purple-bg px-2 py-0.5 text-xs text-purple">
                            {main.name}
                          </span>
                        )}
                        {sub && (
                          <span className="rounded-full bg-info-bg px-2 py-0.5 text-xs text-info">
                            {sub.name}
                          </span>
                        )}
                      </div>

                      <span className="text-sm font-medium tabular-nums text-navy max-md:mt-2 max-md:block md:text-right">
                        {gbp.format(item.price)}
                      </span>

                      <div className="max-md:mt-2">
                        <button
                          onClick={() => toggleAvailability(item)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${
                            item.is_available
                              ? "bg-success-bg text-success"
                              : "bg-slate-bg text-slate-subtle"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              item.is_available ? "bg-success" : "bg-slate-muted"
                            }`}
                          />
                          {item.is_available ? "Available" : "Off menu"}
                        </button>
                      </div>

                      <div className="flex gap-1 max-md:mt-3 md:justify-end">
                        <button
                          onClick={() => {
                            setEditing(item);
                            setFormOpen(true);
                          }}
                          aria-label="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-muted hover:bg-info-bg hover:text-info"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(item)}
                          aria-label="Remove"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-muted hover:bg-danger-bg hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Item form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-navy">
              {editing ? "Edit item" : "Add item"}
            </DialogTitle>
          </DialogHeader>
          <MenuItemForm
            item={editing}
            mains={mains}
            subs={subs}
            onSaved={(saved) => {
              setItems((prev) =>
                editing ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]
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

      {/* Delete confirmation */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-navy">
              Remove {confirmDelete?.title}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-subtle">
              This takes the item off the menu. Past orders that included it stay intact, and you
              can put it back at any time.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => confirmDelete && remove(confirmDelete)}
                className="bg-danger text-white hover:bg-danger/90"
              >
                Remove
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}