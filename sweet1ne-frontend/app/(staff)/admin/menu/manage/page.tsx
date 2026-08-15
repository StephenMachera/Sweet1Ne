"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { CategoryManager } from "@/components/menu/category-manager";
import { MenuItemForm } from "@/components/menu/menu-item-form";
import { BranchScopePicker, type Branch, type Scope } from "@/components/menu/branch-scope-picker";
import type { MainCategory, MenuItem, SubCategory } from "@/components/menu/menu-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const SCOPE_KEY = "sweet1ne_admin_menu_scope";

type Tab = "items" | "subs" | "mains";

export default function AdminMenuManagePage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [tab, setTab] = useState<Tab>("items");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [scope, setScope] = useState<Scope>({ branchId: null, sharedOnly: false });
  const [mains, setMains] = useState<MainCategory[]>([]);
  const [subs, setSubs] = useState<SubCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<MenuItem | null>(null);

  const canEdit = hasPermission(me, "edit_menu");

  useEffect(() => {
    const saved = window.localStorage.getItem(SCOPE_KEY);
    if (saved) {
      try {
        setScope(JSON.parse(saved));
      } catch {
        /* ignore malformed value */
      }
    }
  }, []);

  function changeScope(next: Scope) {
    setScope(next);
    window.localStorage.setItem(SCOPE_KEY, JSON.stringify(next));
  }

  const scopeQuery = scope.sharedOnly
    ? "?shared_only=true&include_inactive=true"
    : scope.branchId
      ? `?branch_id=${scope.branchId}&include_inactive=true`
      : "?include_inactive=true";

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([
      apiFetch(`/staff/menu/main-categories${scopeQuery}`),
      apiFetch(`/staff/menu/sub-categories${scopeQuery}`),
      apiFetch(`/staff/menu/menu-items${scopeQuery}`),
    ])
      .then(([m, s, i]) => {
        setMains(m);
        setSubs(s);
        setItems(i);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [scopeQuery]);

  useEffect(() => {
    apiFetch("/branches").then(setBranches).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canEdit) {
      router.replace("/admin/dashboard");
      return;
    }
    load();
  }, [meLoading, me, canEdit, router, load]);

  async function remove(item: MenuItem) {
    setConfirmDelete(null);
    setError(null);
    try {
      await apiFetch(`/staff/menu/menu-items/${item.id}`, { method: "DELETE" });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: false } : i)));
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
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  const subById = new Map(subs.map((s) => [s.id, s]));
  const mainById = new Map(mains.map((m) => [m.id, m]));
  const branchById = new Map(branches.map((b) => [b.id, b]));

  const visibleItems = items.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.description ?? "").toLowerCase().includes(q)
    );
  });

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "items", label: "Items", count: items.length },
    { key: "subs", label: "Subcategories", count: subs.length },
    { key: "mains", label: "Main categories", count: mains.length },
  ];

  const scopeLabel = scope.sharedOnly
    ? "shared across all branches"
    : scope.branchId
      ? branchById.get(scope.branchId)?.name ?? "one branch"
      : "every branch";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink max-md:hidden">Menu</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {items.length} item{items.length === 1 ? "" : "s"} · {scopeLabel}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/menu/preview"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/12 bg-white px-3.5 text-sm text-ink-muted transition-colors hover:text-ink"
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
              className="bg-gold text-ink hover:bg-gold/90"
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
          className="rounded-lg border border-ember/25 bg-ember-soft px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      )}

      <BranchScopePicker branches={branches} scope={scope} onChange={changeScope} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm transition-colors ${
              tab === t.key ? "font-medium text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-ink-muted">{t.count}</span>
            {tab === t.key && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" />
            )}
          </button>
        ))}
      </div>

      {tab === "mains" && (
        <CategoryManager
          level="main"
          mains={mains}
          subs={subs}
          onChanged={load}
          branchId={scope.branchId}
        />
      )}
      {tab === "subs" && (
        <CategoryManager
          level="sub"
          mains={mains}
          subs={subs}
          onChanged={load}
          branchId={scope.branchId}
        />
      )}

      {tab === "items" && (
        <>
          <div className="relative max-w-sm">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items…"
              className="h-10 bg-white pl-9"
            />
          </div>

          {loading ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink/15 bg-white/50 px-6 py-16 text-center">
              <p className="text-sm text-ink-muted">
                {items.length === 0
                  ? "Nothing on this menu yet. Start by adding a main category."
                  : "No items match that search."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-ink/8 bg-white shadow-[0_1px_3px_rgba(20,24,28,0.04)]">
              <div className="hidden border-b border-ink/8 bg-[#FBFCFD] px-5 py-3 text-[11px] uppercase tracking-[0.12em] text-ink-muted md:grid md:grid-cols-[1.5fr_1fr_120px_100px_110px_90px] md:gap-4">
                <span>Item</span>
                <span>Category</span>
                <span>Branch</span>
                <span className="text-right">Price</span>
                <span>Availability</span>
                <span className="text-right">Actions</span>
              </div>

              <ul className="divide-y divide-ink/5">
                {visibleItems.map((item) => {
                  const sub = subById.get(item.sub_category_id);
                  const main = sub ? mainById.get(sub.main_category_id) : undefined;
                  const branchName = main?.branch_id
                    ? branchById.get(main.branch_id)?.name ?? "—"
                    : null;

                  return (
                    <li
                      key={item.id}
                      className="px-5 py-3.5 md:grid md:grid-cols-[1.5fr_1fr_120px_100px_110px_90px] md:items-center md:gap-4"
                    >
                      <div className="flex items-center gap-3">
                        {item.picture ? (
                          <img
                            src={item.picture}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-[10px] text-ink-muted">
                            —
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                          {item.description && (
                            <p className="truncate text-xs text-ink-muted">{item.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-md:mt-2">
                        {main && (
                          <span className="rounded-full bg-violet-soft px-2 py-0.5 text-xs text-violet">
                            {main.name}
                          </span>
                        )}
                        {sub && (
                          <span className="rounded-full bg-teal-soft px-2 py-0.5 text-xs text-teal">
                            {sub.name}
                          </span>
                        )}
                      </div>

                      <span className="max-md:mt-2 max-md:block">
                        {branchName ? (
                          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink-muted">
                            {branchName}
                          </span>
                        ) : (
                          <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs text-[#8a6a28]">
                            Shared
                          </span>
                        )}
                      </span>

                      <span className="text-sm font-medium tabular-nums text-ink max-md:mt-2 max-md:block md:text-right">
                        {gbp.format(item.price)}
                      </span>

                      <div className="max-md:mt-2">
                        <button
                          onClick={() => toggleAvailability(item)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${
                            item.is_available
                              ? "bg-sage-soft text-sage"
                              : "bg-ink/5 text-ink-muted"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              item.is_available ? "bg-sage" : "bg-ink-muted"
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
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-teal-soft hover:text-teal"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(item)}
                          aria-label="Remove"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-ember-soft hover:text-ember"
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
            <DialogTitle className="font-display text-xl">
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
      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Remove {confirmDelete?.title}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              This takes the item off the menu. Past orders that included it stay intact, and you
              can put it back at any time.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => confirmDelete && remove(confirmDelete)}
                className="bg-ember text-white hover:bg-ember/90"
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