"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Grid3x3, Plus, Printer } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { TableForm, type Table } from "@/components/tables/table-form";
import { TableCard } from "@/components/tables/table-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function BranchTablesPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [tables, setTables] = useState<Table[]>([]);
  const [regionFilter, setRegionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Table | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = hasPermission(me, "manage_tables");

  const load = useCallback(
    () =>
      apiFetch("/tables")
        .then(setTables)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) {
      router.replace(`/${branchSlug}/menu`);
      return;
    }
    load();
  }, [meLoading, me, canManage, branchSlug, router, load]);

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
    return <p className="text-sm text-slate-muted">Loading…</p>;
  }

  const regions = Array.from(
    new Set(tables.map((t) => t.region).filter(Boolean) as string[])
  ).sort();

  const visible = tables
    .filter((t) => !regionFilter || t.region === regionFilter)
    .sort((a, b) => a.number - b.number);

  const activeCount = tables.filter((t) => t.is_active).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy sm:text-3xl">Tables</h1>
          <p className="mt-1 text-sm text-slate-subtle">
            {activeCount} active of {tables.length}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="border-slate-border text-slate-subtle"
          >
            <Printer size={16} className="mr-1.5" />
            Print codes
          </Button>
          <Button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
            className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
          >
            <Plus size={16} className="mr-1.5" />
            Add table
          </Button>
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

      {regions.length > 0 && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            onClick={() => setRegionFilter("")}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              regionFilter === ""
                ? "bg-gradient-to-br from-emerald to-emerald-dark text-white"
                : "border border-slate-border bg-white text-slate-subtle hover:text-navy"
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
                  ? "bg-gradient-to-br from-emerald to-emerald-dark text-white"
                  : "border border-slate-border bg-white text-slate-subtle hover:text-navy"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-border bg-white/50 px-6 py-16 text-center">
          <Grid3x3 size={26} className="mx-auto text-slate-muted" />
          <p className="mt-3 text-sm text-slate-muted">
            {tables.length === 0
              ? "No tables yet. Add your first one to start taking QR orders."
              : "No tables in this area."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              tone="branch"
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
            <DialogTitle className="text-xl font-semibold text-navy">
              {editing ? "Edit table" : "Add table"}
            </DialogTitle>
          </DialogHeader>
          <TableForm
            table={editing}
            fixedBranchId={me.branch_id}
            tone="branch"
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