"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Grid3x3, Plus, Printer } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { TableForm, type Table } from "@/components/tables/table-form";
import { TableCard } from "@/components/tables/table-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  const canManage = hasPermission(me, "manage_tables");

  useEffect(() => {
    setBranchFilter(window.localStorage.getItem(BRANCH_KEY) ?? "");
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
    return <p className="text-sm text-ink-muted">Loading…</p>;
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink max-md:hidden">Tables</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {visible.length} of {tables.length} across {branches.length}{" "}
            branch{branches.length === 1 ? "" : "es"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer size={16} className="mr-1.5" />
            Print codes
          </Button>
          <Button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
            className="bg-gold text-ink hover:bg-gold/90"
          >
            <Plus size={16} className="mr-1.5" />
            Add table
          </Button>
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

      <div className="space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.14em] text-ink-muted">Branch</span>
          <button
            onClick={() => changeBranchFilter("")}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              branchFilter === ""
                ? "bg-ink text-paper"
                : "border border-ink/12 bg-white text-ink-muted hover:text-ink"
            }`}
          >
            All branches
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => changeBranchFilter(branchFilter === b.id ? "" : b.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                branchFilter === b.id
                  ? "bg-ink text-paper"
                  : "border border-ink/12 bg-white text-ink-muted hover:text-ink"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        {regions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.14em] text-ink-muted">Area</span>
            <button
              onClick={() => setRegionFilter("")}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                regionFilter === ""
                  ? "bg-gold text-ink"
                  : "border border-ink/12 bg-white text-ink-muted hover:text-ink"
              }`}
            >
              All areas
            </button>
            {regions.map((r) => (
              <button
                key={r}
                onClick={() => setRegionFilter(regionFilter === r ? "" : r)}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  regionFilter === r
                    ? "bg-gold text-ink"
                    : "border border-ink/12 bg-white text-ink-muted hover:text-ink"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/15 bg-white/50 px-6 py-16 text-center">
          <Grid3x3 size={26} className="mx-auto text-ink-muted" />
          <p className="mt-3 text-sm text-ink-muted">
            {tables.length === 0
              ? "No tables yet. Add one to start taking QR orders."
              : "No tables match these filters."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editing ? "Edit table" : "Add table"}
            </DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}