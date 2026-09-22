"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { TableForm, type Table } from "@/components/tables/table-form";
import { TableCard } from "@/components/tables/table-card";
import { AdminLoading } from "@/components/admin/admin-loading";

const BRANCH_KEY = "sweet1ne_admin_tables_branch";

type Branch = { id: string; name: string };

export default function AdminTablesPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [tables, setTables] = useState<Table[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Table | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  const canManage = hasPermission(me, "manage_tables");

  useEffect(() => {
    setBranchFilter(window.localStorage.getItem(BRANCH_KEY) ?? "");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

  const load = useCallback(
    () =>
      apiFetch("/tables")
        .then(setTables)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    apiFetch("/branches").then(setBranches).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) {
      router.replace("/admin/dashboard");
      return;
    }
    load();
  }, [meLoading, me, canManage, router, load]);

  function changeBranchFilter(value: string) {
    setBranchFilter(value);
    setRegionFilter("");
    window.localStorage.setItem(BRANCH_KEY, value);
  }

  async function regenerate(table: Table) {
    setBusyId(table.id);
    setError(null);
    try {
      const updated = await apiFetch(`/tables/${table.id}/qr`, { method: "POST" });
      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate that QR code.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(table: Table) {
    setError(null);
    try {
      if (table.is_active) {
        await apiFetch(`/tables/${table.id}`, { method: "DELETE" });
        setTables((prev) =>
          prev.map((t) => (t.id === table.id ? { ...t, is_active: false } : t))
        );
      } else {
        const updated = await apiFetch(`/tables/${table.id}`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: true }),
        });
        setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update that table.");
    }
  }

  if (meLoading || !me || !canManage) {
    return <AdminLoading />;
  }

  const branchById = new Map(branches.map((b) => [b.id, b]));

  const branchScoped = tables.filter((t) => !branchFilter || t.branch_id === branchFilter);
  const regions = Array.from(
    new Set(branchScoped.map((t) => t.region).filter(Boolean) as string[])
  ).sort();

  const visible = branchScoped
    .filter((t) => !regionFilter || t.region === regionFilter)
    .sort((a, b) => {
      const branchDiff = (branchById.get(a.branch_id)?.name ?? "").localeCompare(
        branchById.get(b.branch_id)?.name ?? ""
      );
      return branchDiff !== 0 ? branchDiff : a.number - b.number;
    });

  return (
    <>
      <div className="admin-top">
        <div className="admin-places print:hidden" role="group" aria-label="Branch">
          <button
            type="button"
            className={branchFilter === "" ? "is-on" : undefined}
            onClick={() => changeBranchFilter("")}
          >
            All branches
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={branchFilter === b.id ? "is-on" : undefined}
              onClick={() => changeBranchFilter(branchFilter === b.id ? "" : b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Tables</h1>
      <p className="admin-dek">
        {visible.length} of {tables.length} across {branches.length} branch
        {branches.length === 1 ? "" : "es"}
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <div className="admin-tools print:hidden">
        <button type="button" className="admin-book" onClick={() => window.print()}>
          Print codes
        </button>
        <button
          type="button"
          className="admin-book ml-auto"
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          Add table
        </button>
      </div>

      {regions.length > 0 && (
        <div className="admin-cats print:hidden" role="group" aria-label="Area">
          <button
            type="button"
            className={regionFilter === "" ? "is-on" : undefined}
            onClick={() => setRegionFilter("")}
          >
            All areas
          </button>
          {regions.map((r) => (
            <button
              key={r}
              type="button"
              className={regionFilter === r ? "is-on" : undefined}
              onClick={() => setRegionFilter(regionFilter === r ? "" : r)}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <AdminLoading />
      ) : visible.length === 0 ? (
        <p className="admin-empty">
          {tables.length === 0
            ? "No tables yet. Add one to start taking QR orders."
            : "No tables match these filters."}
        </p>
      ) : (
        <div className="admin-tables-grid">
          {visible.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              tone="admin"
              branchName={branchById.get(table.branch_id)?.name}
              busy={busyId === table.id}
              onEdit={() => {
                setEditing(table);
                setFormOpen(true);
              }}
              onRegenerate={() => regenerate(table)}
              onToggleActive={() => toggleActive(table)}
            />
          ))}
        </div>
      )}

      {/* Editor — portaled into the third grid column owned by the shared
          /admin layout, same as menu and events. No live preview here,
          just the form. See #admin-drawer-slot in admin/layout.tsx. */}
      {formOpen &&
        drawerSlot &&
        createPortal(
          <aside className="admin-drawer-edit">
            <h2>{editing ? "Edit table" : "Add table"}</h2>
            <TableForm
              table={editing}
              branches={branches}
              fixedBranchId={branchFilter || null}
              tone="admin"
              onSaved={(saved) => {
                setTables((prev) =>
                  editing ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved]
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