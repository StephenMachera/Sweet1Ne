"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { MainCategory, MenuItem, SubCategory } from "@/components/menu/menu-browser";
import { AdminLoading } from "@/components/admin/admin-loading";

/**
 * The "86" tab shared by admin Kitchen and Bar — the same menu items and
 * PATCH is_available toggle as /admin/menu/manage, just scoped to one
 * prep_station (kitchen or bar) so each floor only sees what's actually
 * theirs to run out of.
 */
export function EightySix({ station, branchId }: { station: "kitchen" | "bar"; branchId: string }) {
  const [mains, setMains] = useState<MainCategory[]>([]);
  const [subs, setSubs] = useState<SubCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scopeQuery = branchId ? `?branch_id=${branchId}&include_inactive=true` : "?include_inactive=true";

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
    load();
  }, [load]);

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

  const stationMains = mains.filter((m) => m.prep_station === station);
  const stationMainIds = new Set(stationMains.map((m) => m.id));
  const subById = new Map(subs.map((s) => [s.id, s]));
  const mainById = new Map(mains.map((m) => [m.id, m]));

  const stationItems = items.filter((item) => {
    const sub = subById.get(item.sub_category_id);
    return sub && stationMainIds.has(sub.main_category_id);
  });

  const CATS = ["All", ...stationMains.map((m) => m.name)];

  const visible = stationItems.filter((item) => {
    if (cat !== "All") {
      const sub = subById.get(item.sub_category_id);
      const main = sub ? mainById.get(sub.main_category_id) : undefined;
      if (main?.name !== cat) return false;
    }
    if (query && !item.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      {CATS.length > 1 && (
        <div className="admin-cats" role="group" aria-label="Category">
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
      )}

      <div className="admin-tools">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
      </div>

      {loading ? (
        <AdminLoading />
      ) : visible.length === 0 ? (
        <p className="admin-empty">Nothing on this filter.</p>
      ) : (
        <div className="admin-data-panel">
          <table className="admin-sheet">
            <thead>
              <tr>
                <th>On</th>
                <th>Item</th>
                <th>Category</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const sub = subById.get(item.sub_category_id);
                const main = sub ? mainById.get(sub.main_category_id) : undefined;
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
                    <td>
                      <span className="admin-name">{item.title}</span>
                    </td>
                    <td className="admin-muted">
                      {main?.name}
                      {sub ? ` · ${sub.name}` : ""}
                    </td>
                    <td>
                      <span className={item.is_available ? "admin-status is-ok" : "admin-status"}>
                        {item.is_available ? "On" : "86'd"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
