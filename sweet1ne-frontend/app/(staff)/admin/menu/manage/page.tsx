"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { CategoryManager } from "@/components/menu/category-manager";
import { MenuItemForm, emptyDraft, type MenuItemDraft } from "@/components/menu/menu-item-form";
import { BranchScopePicker, type Branch, type Scope } from "@/components/menu/branch-scope-picker";
import type { MainCategory, MenuItem, SubCategory } from "@/components/menu/menu-browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const SCOPE_KEY = "sweet1ne_admin_menu_scope";
// Literal colors, not var(--gold-line) etc — Dialog portals to
// document.body, outside .admin-shell, so those custom properties (only
// defined under that class) don't cascade here and the panel, its text
// and its .admin-book buttons would all render uncolored without them.
const DARK_DIALOG =
  "border border-[rgba(201,162,74,0.42)] bg-[#0c0c0c] text-[#e5e2e1] sm:max-w-lg max-h-[90vh] overflow-y-auto";
const DIALOG_BOOK_BTN =
  "inline-block rounded-[3px] border border-[rgba(201,162,74,0.9)] bg-transparent px-[1.15rem] py-[0.7rem] text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#c9a24a] hover:bg-[#c9a24a] hover:text-[#0e0e0e]";

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
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | undefined>();
  const [draft, setDraft] = useState<MenuItemDraft>(emptyDraft());
  const [confirmDelete, setConfirmDelete] = useState<MenuItem | null>(null);
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  const canEdit = hasPermission(me, "edit_menu");

  // The editor renders in the third grid column owned by admin/layout.tsx,
  // not here — see #admin-drawer-slot and .admin-shell:has(...) in
  // globals.css. That element only exists in the real DOM once the layout
  // has committed, so this has to run post-commit, not during render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

  function openAdd() {
    setEditing(undefined);
    setDraft(emptyDraft());
    setFormOpen(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    setDraft(emptyDraft(item));
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(undefined);
  }

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
    return <p className="text-sm text-[var(--ivory-dim)]">Loading…</p>;
  }

  const subById = new Map(subs.map((s) => [s.id, s]));
  const mainById = new Map(mains.map((m) => [m.id, m]));
  const branchById = new Map(branches.map((b) => [b.id, b]));

  // Category filter pills, driven by the real (branch-scoped) main categories
  // instead of the template's fixed Starters/Mains/… list.
  const CATS = ["All", ...mains.map((m) => m.name), "Needs picture"];

  const visibleItems = items.filter((item) => {
    if (cat === "Needs picture" && item.picture) return false;
    if (cat !== "All" && cat !== "Needs picture") {
      const sub = subById.get(item.sub_category_id);
      const main = sub ? mainById.get(sub.main_category_id) : undefined;
      if (main?.name !== cat) return false;
    }
    if (query) {
      const q = query.toLowerCase();
      const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const on = items.filter((i) => i.is_available).length;
  const withPic = items.filter((i) => i.picture).length;
  const needPic = items.filter((i) => i.is_available && !i.picture).length;

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
    <>
      <div className="admin-top">
        <BranchScopePicker branches={branches} scope={scope} onChange={changeScope} />
        <Link href="/admin/menu/preview" className="admin-who">
          Preview as customer →
        </Link>
      </div>

      <h1>Menu</h1>
      <p className="admin-dek">
        {items.length} item{items.length === 1 ? "" : "s"} · {scopeLabel}
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <div className="admin-cats" role="tablist" aria-label="Section">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "is-on" : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label} · {t.count}
          </button>
        ))}
      </div>

      {tab === "mains" && (
        <CategoryManager tone="admin" level="main" mains={mains} subs={subs} onChanged={load} branchId={scope.branchId} />
      )}
      {tab === "subs" && (
        <CategoryManager tone="admin" level="sub" mains={mains} subs={subs} onChanged={load} branchId={scope.branchId} />
      )}

      {tab === "items" && (
        <>
          <div className="admin-kpi-strip" aria-label="Summary">
            <div>
              <span className="admin-kpi-n">{on}</span>
              <span className="admin-kpi-l">On menu</span>
            </div>
            <div>
              <span className="admin-kpi-n">{items.length - on}</span>
              <span className="admin-kpi-l">Off</span>
            </div>
            <div>
              <span className="admin-kpi-n">{withPic}</span>
              <span className="admin-kpi-l">With picture</span>
            </div>
            <div>
              <span className="admin-kpi-n">{needPic}</span>
              <span className="admin-kpi-l">Need a picture</span>
            </div>
          </div>

          <div className="admin-cats">
            {CATS.map((name) => (
              <button
                key={name}
                type="button"
                className={cat === name ? "is-on" : undefined}
                onClick={() => setCat(name)}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="admin-tools">
            <input
              type="search"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className="admin-book" onClick={openAdd}>
              Add item
            </button>
          </div>

          {formOpen && (
            <section className="admin-dish-preview">
              <p className="admin-kicker">Website and phone</p>
              <div className="admin-dish-stills">
                {draft.picture ? (
                  <img src={draft.picture} alt="" />
                ) : (
                  <p className="admin-dek">Pick a picture. The phone shows it with the dish.</p>
                )}
              </div>
              <h2>{draft.title.trim() || "Name sits here."}</h2>
              <p className="admin-dek">
                {draft.description.trim() || "Write the dish. Guests see this on the website and the phone."}
              </p>
              <p className="admin-price">{draft.price.trim() ? gbp.format(Number(draft.price) || 0) : ""}</p>
            </section>
          )}

          {loading ? (
            <p className="text-sm text-[var(--ivory-dim)]">Loading…</p>
          ) : visibleItems.length === 0 ? (
            <p className="admin-hold px-5 py-10 text-center text-sm">
              {items.length === 0
                ? "Nothing on this menu yet. Start by adding a main category."
                : "No items match that search."}
            </p>
          ) : (
            <div className="admin-data-panel">
              <table className="admin-sheet">
                <thead>
                  <tr>
                    <th>On</th>
                    <th></th>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Restaurant</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => {
                    const sub = subById.get(item.sub_category_id);
                    const main = sub ? mainById.get(sub.main_category_id) : undefined;
                    const branchName = main?.branch_id ? branchById.get(main.branch_id)?.name ?? "—" : null;

                    return (
                      <tr key={item.id}>
                        <td>
                          <button
                            type="button"
                            aria-label="On"
                            className={`admin-toggle${item.is_available ? " is-on" : ""}`}
                            onClick={() => toggleAvailability(item)}
                          />
                        </td>
                        <td className="admin-pic">
                          {item.picture ? <img src={item.picture} alt="" /> : "—"}
                        </td>
                        <td>
                          <span className="admin-name">{item.title}</span>
                          {item.description && <div className="admin-muted">{item.description}</div>}
                        </td>
                        <td className="admin-muted">
                          {main?.name}
                          {sub ? ` · ${sub.name}` : ""}
                        </td>
                        <td className="admin-price">{gbp.format(item.price)}</td>
                        <td className="admin-muted">{branchName ?? "Shared"}</td>
                        <td>
                          <div className="flex gap-3">
                            <button type="button" className="admin-edit" onClick={() => openEdit(item)}>
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

      {/* Item editor — portaled into the third grid column owned by the
          shared /admin layout, not a modal. See #admin-drawer-slot. */}
      {formOpen &&
        drawerSlot &&
        createPortal(
          <aside className="admin-drawer-edit is-builder">
            <h2>{editing ? "Edit item" : "Add item"}</h2>
            <p className="admin-dek">
              This dish is the website and the table phone. The picture is what guests see first.
            </p>
            <MenuItemForm
              tone="admin"
              item={editing}
              mains={mains}
              subs={subs}
              draft={draft}
              onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              onSaved={(saved) => {
                setItems((prev) => (editing ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]));
                closeForm();
              }}
              onCancel={closeForm}
            />
          </aside>,
          drawerSlot
        )}

      {/* Delete confirmation */}
      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className={DARK_DIALOG + " sm:max-w-md"}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#e5e2e1]">
              Remove {confirmDelete?.title}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[rgba(229,226,225,0.68)]">
            This takes the item off the menu. Past orders that included it stay intact, and you can put it
            back at any time.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className={DIALOG_BOOK_BTN} onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={DIALOG_BOOK_BTN}
              onClick={() => confirmDelete && remove(confirmDelete)}
            >
              Remove
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
