"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { slugify } from "@/lib/utils";
import { useMe, hasPermission } from "@/lib/use-me";
import { CategoryManager } from "@/components/menu/category-manager";
import { MenuBoard } from "@/components/menu/menu-board";
import { MenuItemForm, emptyDraft, type MenuItemDraft } from "@/components/menu/menu-item-form";
import { BranchScopePicker, type Branch, type Scope } from "@/components/menu/branch-scope-picker";
import type { MainCategory, MenuItem, SubCategory } from "@/components/menu/menu-browser";
import { AdminLoading } from "@/components/admin/admin-loading";

type MenuJsonPack = {
  mains?: { name: string; prep_station?: string; picture?: string | null }[];
  subs?: { name: string; main: string }[];
  items?: {
    title: string;
    description?: string | null;
    price: number;
    main: string;
    sub: string;
    picture?: string | null;
    pictures?: string[];
    dietary_tags?: string[];
    allergen_tags?: string[];
  }[];
};

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const SCOPE_KEY = "sweet1ne_admin_menu_scope";

type Tab = "items" | "subs" | "mains";

// The real "Bar" course here is already named "Drinks" in this tenant's own
// categories — without this, loading menu.json would create a second,
// duplicate course instead of adding into the one that already exists.
const LEGACY_CATEGORY_ALIASES: Record<string, string> = { Bar: "Drinks" };

type LegacyMenuPack = {
  courses?: { cat: string; mediaId?: string }[];
  media?: { id: string; file: string }[];
  items?: { cat: string; sub?: string; name: string; desc?: string; price?: string; mediaIds?: string[] }[];
};

function legacyMainName(cat: string): string {
  return LEGACY_CATEGORY_ALIASES[cat] ?? cat;
}

/** "£12.50" → 12.5, "from £7" → 7. "—" and the like have no real number in
 *  them at all — those items are skipped rather than guessing a price. */
function parseLegacyPrice(raw: string | undefined): number | null {
  const match = (raw ?? "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/** Converts the reference build's own menu.json shape (courses/media/items,
 *  photo files instead of uploaded media) into this page's own import pack,
 *  so "Load menu.json" can go through the exact same additive apply as
 *  "Import JSON" rather than a separate write path. */
function transformLegacyMenuPack(legacy: LegacyMenuPack): {
  pack: MenuJsonPack;
  warnings: string[];
} {
  const warnings: string[] = [];
  const mediaFile = new Map<string, string>(
    (legacy.media ?? []).map((m) => [m.id, `/images/${m.file}`]),
  );

  const mainPictures = new Map<string, string>();
  const mainOrder: string[] = [];
  for (const course of legacy.courses ?? []) {
    const name = legacyMainName(course.cat);
    if (!mainOrder.includes(name)) mainOrder.push(name);
    const picture = course.mediaId ? mediaFile.get(course.mediaId) : undefined;
    if (picture && !mainPictures.has(name)) mainPictures.set(name, picture);
  }
  const mains: NonNullable<MenuJsonPack["mains"]> = mainOrder.map((name) => ({
    name,
    picture: mainPictures.get(name) ?? null,
  }));

  const subSeen = new Set<string>();
  const subs: NonNullable<MenuJsonPack["subs"]> = [];
  const items: NonNullable<MenuJsonPack["items"]> = [];

  for (const item of legacy.items ?? []) {
    const main = legacyMainName(item.cat);
    const sub = item.sub?.trim() || "General";
    const key = `${main.toLowerCase()}::${sub.toLowerCase()}`;
    if (!subSeen.has(key)) {
      subSeen.add(key);
      subs.push({ name: sub, main });
    }

    const price = parseLegacyPrice(item.price);
    if (price === null) {
      warnings.push(`Item "${item.name}": no fixed price ("${item.price}") — add it by hand.`);
      continue;
    }

    const pictures = (item.mediaIds ?? [])
      .map((id) => mediaFile.get(id))
      .filter((url): url is string => Boolean(url));

    items.push({ title: item.name, description: item.desc || null, price, main, sub, pictures });
  }

  return { pack: { mains, subs, items }, warnings };
}

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
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  // Set only while a specific course is picked — a real fetch scoped to
  // that course, not a client-side filter of everything already loaded.
  // null means "use the full `items` list" (All / Needs picture).
  const [categoryItems, setCategoryItems] = useState<MenuItem[] | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);

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

  // Clicking a real course re-fetches just that course's items from the
  // server — "All" and "Needs picture" fall back to the already-loaded
  // full list (there's no "no picture" filter on the endpoint, and "All"
  // needs everything anyway).
  function selectCategory(name: string) {
    setCat(name);
    if (name === "All" || name === "Needs picture") return;
    const main = mains.find((m) => m.name === name);
    if (!main) return;
    setCategoryLoading(true);
    apiFetch(`/staff/menu/menu-items${scopeQuery}&main_category_id=${main.id}`)
      .then((rows: MenuItem[]) => setCategoryItems(rows))
      .catch((e) => setError(e.message))
      .finally(() => setCategoryLoading(false));
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
    return <AdminLoading />;
  }

  const subById = new Map(subs.map((s) => [s.id, s]));
  const mainById = new Map(mains.map((m) => [m.id, m]));
  const branchById = new Map(branches.map((b) => [b.id, b]));

  // Category filter pills, driven by the real (branch-scoped) main categories
  // instead of the template's fixed Starters/Mains/… list.
  const CATS = ["All", ...mains.map((m) => m.name), "Needs picture"];
  const mainByName = new Map(mains.map((m) => [m.name, m]));

  // Download/Import JSON — a real backup-and-bulk-add tool, not the
  // reference build's localStorage round-trip. Names, not ids, are the
  // join keys, since ids from one tenant's export mean nothing on import.
  // "Load menu.json" from the reference build has no equivalent here —
  // there's no static file to load, only the real list already on screen.
  function exportJson() {
    const data: MenuJsonPack = {
      mains: mains.map((m) => ({ name: m.name, prep_station: m.prep_station, picture: m.picture })),
      subs: subs.map((s) => ({ name: s.name, main: mainById.get(s.main_category_id)?.name ?? "" })),
      items: items.map((item) => {
        const sub = subById.get(item.sub_category_id);
        const main = sub ? mainById.get(sub.main_category_id) : undefined;
        return {
          title: item.title,
          description: item.description,
          price: item.price,
          main: main?.name ?? "",
          sub: sub?.name ?? "",
          picture: item.picture,
          pictures: item.pictures,
          dietary_tags: item.dietary_tags,
          allergen_tags: item.allergen_tags,
        };
      }),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sweet1ne-menu.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Shared by "Import JSON" and "Load menu.json" — only ever adds, never
  // updates or removes an existing category or item, so running either one
  // twice is safe, just skips anything already matched by name.
  async function applyMenuPack(data: MenuJsonPack): Promise<string[]> {
    const failures: string[] = [];

    const mainByNameLocal = new Map(mains.map((m) => [m.name.toLowerCase(), m]));
    for (const m of data.mains ?? []) {
      if (mainByNameLocal.has(m.name.toLowerCase())) continue;
      try {
        const created: MainCategory = await apiFetch("/staff/menu/main-categories", {
          method: "POST",
          body: JSON.stringify({
            name: m.name,
            slug: slugify(m.name),
            branch_id: scope.branchId,
            prep_station: m.prep_station ?? "kitchen",
            picture: m.picture ?? null,
          }),
        });
        mainByNameLocal.set(m.name.toLowerCase(), created);
      } catch (err) {
        failures.push(`Category "${m.name}": ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    const subKey = (mainName: string, subName: string) => `${mainName.toLowerCase()}::${subName.toLowerCase()}`;
    const subByKeyLocal = new Map(
      subs.map((s) => [subKey(mainById.get(s.main_category_id)?.name ?? "", s.name), s]),
    );
    for (const s of data.subs ?? []) {
      const main = mainByNameLocal.get(s.main.toLowerCase());
      if (!main) {
        failures.push(`Subcategory "${s.name}": no main category "${s.main}"`);
        continue;
      }
      const key = subKey(s.main, s.name);
      if (subByKeyLocal.has(key)) continue;
      try {
        const created: SubCategory = await apiFetch("/staff/menu/sub-categories", {
          method: "POST",
          body: JSON.stringify({ name: s.name, slug: slugify(s.name), main_category_id: main.id }),
        });
        subByKeyLocal.set(key, created);
      } catch (err) {
        failures.push(`Subcategory "${s.name}": ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    for (const it of data.items ?? []) {
      const sub = subByKeyLocal.get(subKey(it.main, it.sub));
      if (!sub) {
        failures.push(`Item "${it.title}": no subcategory "${it.sub}" under "${it.main}"`);
        continue;
      }
      try {
        await apiFetch("/staff/menu/menu-items", {
          method: "POST",
          body: JSON.stringify({
            sub_category_id: sub.id,
            title: it.title,
            description: it.description ?? null,
            price: it.price,
            pictures: it.pictures ?? (it.picture ? [it.picture] : []),
            dietary_tags: it.dietary_tags ?? [],
            allergen_tags: it.allergen_tags ?? [],
          }),
        });
      } catch (err) {
        failures.push(`Item "${it.title}": ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    return failures;
  }

  async function runMenuPack(
    getPack: () => Promise<{ pack: MenuJsonPack; warnings?: string[] }>,
    notFoundMessage: string,
  ) {
    setImporting(true);
    setImportError(null);
    try {
      const { pack, warnings = [] } = await getPack();
      const failures = [...warnings, ...(await applyMenuPack(pack))];
      await load();
      if (failures.length) {
        setImportError(
          `Added what it could — ${failures.length} issue${failures.length === 1 ? "" : "s"}: ${failures.slice(0, 3).join("; ")}${failures.length > 3 ? "…" : ""}`,
        );
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : notFoundMessage);
    } finally {
      setImporting(false);
    }
  }

  function importJson(file: File) {
    return runMenuPack(
      async () => ({ pack: JSON.parse(await file.text()) as MenuJsonPack }),
      "Couldn't read that file.",
    );
  }

  // "Load menu.json" — the reference build's own fixed photo-and-recipe
  // pack (courses/media/items, not this page's own export shape), bundled
  // as a static file rather than fetched from a live menu elsewhere.
  function loadMenuPack() {
    return runMenuPack(async () => {
      const res = await fetch("/menu.json");
      if (!res.ok) throw new Error("menu.json not found.");
      return transformLegacyMenuPack(await res.json());
    }, "Couldn't load menu.json.");
  }

  // categoryItems holds whatever course was last fetched — only live when
  // that's still the active filter, so switching back to All/Needs picture
  // drops it without needing an extra effect branch just to reset it.
  const activeCategoryItems =
    cat !== "All" && cat !== "Needs picture" ? categoryItems : null;

  // categoryItems is already the server's own answer for "just this course"
  // — no need to re-check main category name against it client-side.
  const visibleItems = (activeCategoryItems ?? items).filter((item) => {
    if (cat === "Needs picture" && item.picture) return false;
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
            <details className="admin-fold">
              <summary>JSON</summary>
              <div className="admin-fold-box">
                <button type="button" className="admin-edit" onClick={exportJson}>
                  Download JSON
                </button>
                <button
                  type="button"
                  className="admin-edit"
                  disabled={importing}
                  onClick={() => importFileRef.current?.click()}
                >
                  {importing ? "Importing…" : "Import JSON"}
                </button>
                <button type="button" className="admin-edit" disabled={importing} onClick={loadMenuPack}>
                  {importing ? "Loading…" : "Load menu.json"}
                </button>
              </div>
            </details>
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importJson(file);
                e.target.value = "";
              }}
            />
            <Link href="/menu" className="admin-act" target="_blank">
              Website
            </Link>
            <Link href="/admin/menu/preview" className="admin-act">
              Table phone
            </Link>
          </div>
          {importError && <p className="admin-hold mb-3 text-sm">{importError}</p>}

          <div className="admin-courses">
            {CATS.map((name) => {
              const course = mainByName.get(name);
              return (
                <button
                  key={name}
                  type="button"
                  className={`admin-course${name === "All" ? " is-all" : ""}${cat === name ? " is-on" : ""}`}
                  onClick={() => selectCategory(name)}
                >
                  {course?.picture && (
                    <span className="admin-disc">
                      <img src={course.picture} alt="" />
                    </span>
                  )}
                  {name === "Needs picture" ? "Need pic" : name}
                </button>
              );
            })}
          </div>

          {formOpen && (
            <section className="admin-dish-preview is-pair">
              <div>
                <p className="admin-kicker">Website</p>
                <article className="admin-menu-dish">
                  {draft.picture ? (
                    <img src={draft.picture} alt="" />
                  ) : (
                    <span className="admin-menu-gap" />
                  )}
                  <div>
                    <h3>{draft.title.trim() || "Name sits here."}</h3>
                    <p className="admin-muted">
                      {draft.description.trim() ||
                        "Write the dish. Guests see this on the website and the phone."}
                    </p>
                  </div>
                  <p className="admin-price">
                    {draft.price.trim() ? gbp.format(Number(draft.price) || 0) : ""}
                  </p>
                </article>
              </div>
              <div>
                <p className="admin-kicker">Table phone</p>
                <article className="admin-phone-dish">
                  {draft.picture ? (
                    <img src={draft.picture} alt="" />
                  ) : (
                    <span className="admin-phone-gap" />
                  )}
                  <div>
                    <strong>{draft.title.trim() || "Name sits here."}</strong>
                    <p>{draft.description.trim()}</p>
                  </div>
                  <span className="admin-price">
                    {draft.price.trim() ? gbp.format(Number(draft.price) || 0) : ""}
                  </span>
                </article>
              </div>
            </section>
          )}

          {loading || categoryLoading ? (
            <AdminLoading />
          ) : items.length === 0 ? (
            <p className="admin-hold px-5 py-10 text-center text-sm">
              Nothing on this menu yet. Start by adding a main category.
            </p>
          ) : (
            <MenuBoard
              mains={mains}
              subs={subs}
              items={visibleItems}
              onEditItem={openEdit}
              onToggleItem={toggleAvailability}
              onCategoryChanged={(updated) =>
                setMains((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
              }
            />
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

    </>
  );
}
