"use client";

import { use, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { CategoryManager } from "@/components/menu/category-manager";
import { MenuItemForm } from "@/components/menu/menu-item-form";
import type { MainCategory, MenuItem, SubCategory } from "@/components/menu/menu-browser";
import { AdminLoading } from "@/components/admin/admin-loading";

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
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  const canEdit = hasPermission(me, "edit_menu");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

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
    const next = { ...item, is_available: !item.is_available };
    setItems((prev) => prev.map((i) => (i.id === item.id ? next : i)));
    try {
      const updated = await apiFetch(`/staff/menu/menu-items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_available: next.is_available }),
      });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      setError(err instanceof Error ? err.message : "Couldn't update availability.");
    }
  }

  if (meLoading || !me || !canEdit) {
    return <AdminLoading />;
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
    <>
      <div className="admin-top">
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Menu</h1>
      <p className="admin-dek">
        {items.length} item{items.length === 1 ? "" : "s"} across {mains.length}{" "}
        categor{mains.length === 1 ? "y" : "ies"}
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <div className="admin-tools">
        <Link href={`/${branchSlug}/menu/preview`} className="admin-book">
          Preview as customer
        </Link>
        {tab === "items" && (
          <button
            type="button"
            className="admin-book ml-auto"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            Add item
          </button>
        )}
      </div>

      <div className="admin-cats" role="group" aria-label="View">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? "is-on" : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label} {t.count}
          </button>
        ))}
      </div>

      {tab === "mains" && (
        <CategoryManager tone="admin" level="main" mains={mains} subs={subs} onChanged={load} />
      )}
      {tab === "subs" && (
        <CategoryManager tone="admin" level="sub" mains={mains} subs={subs} onChanged={load} />
      )}

      {tab === "items" && (
        <>
          <div className="admin-tools">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items…"
            />
            <select value={mainFilter} onChange={(e) => setMainFilter(e.target.value)}>
              <option value="">All categories</option>
              {mains.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <AdminLoading />
          ) : visibleItems.length === 0 ? (
            <p className="admin-empty">
              {items.length === 0
                ? "No items yet. Add your first one to get started."
                : "No items match these filters."}
            </p>
          ) : (
            <div className="admin-data-panel">
              <table className="admin-sheet">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Availability</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => {
                    const sub = subById.get(item.sub_category_id);
                    const main = sub ? mainById.get(sub.main_category_id) : undefined;

                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            {item.picture ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.picture}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded object-cover"
                              />
                            ) : (
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[var(--gold-line)] text-[10px] text-[var(--ivory-dim)]">
                                —
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="admin-name truncate">{item.title}</p>
                              {item.description && (
                                <p className="admin-muted truncate text-xs">{item.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="admin-muted">
                          {main?.name}
                          {sub ? ` · ${sub.name}` : ""}
                        </td>
                        <td className="admin-price">{gbp.format(item.price)}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => toggleAvailability(item)}
                            className={item.is_available ? "admin-edit" : "admin-edit"}
                          >
                            {item.is_available ? "Available" : "Off menu"}
                          </button>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="admin-edit"
                              onClick={() => {
                                setEditing(item);
                                setFormOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="admin-edit"
                              onClick={() => setConfirmDelete(item)}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {formOpen &&
        drawerSlot &&
        createPortal(
          <aside className="admin-drawer-edit">
            <h2>{editing ? "Edit item" : "Add item"}</h2>
            <MenuItemForm
              tone="admin"
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
          </aside>,
          drawerSlot
        )}

      {confirmDelete &&
        drawerSlot &&
        createPortal(
          <aside className="admin-drawer-edit">
            <h2>Remove {confirmDelete.title}?</h2>
            <p className="admin-dek">
              This takes the item off the menu. Past orders that included it stay intact, and you
              can put it back at any time.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" className="admin-book" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-book"
                onClick={() => remove(confirmDelete)}
              >
                Remove
              </button>
            </div>
          </aside>,
          drawerSlot
        )}
    </>
  );
}
