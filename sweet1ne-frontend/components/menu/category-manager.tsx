"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MainCategory, SubCategory } from "./menu-browser";

const STATIONS = [
  { value: "kitchen", label: "Kitchen" },
  { value: "bar", label: "Bar" },
  { value: "none", label: "No prep" },
];

export function CategoryManager({
  level,
  mains,
  subs,
  onChanged,
  branchId = null,
}: {
  level: "main" | "sub";
  mains: MainCategory[];
  subs: SubCategory[];
  onChanged: () => void;
  branchId?: string | null;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [prepStation, setPrepStation] = useState("kitchen");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftStation, setDraftStation] = useState("kitchen");
  const [draftParent, setDraftParent] = useState("");

  const isMain = level === "main";
  const path = isMain ? "/staff/menu/main-categories" : "/staff/menu/sub-categories";
  const rows = isMain ? mains : subs;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isMain && !parentId) {
      setError("Please choose a main category.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(path, {
        method: "POST",
        body: JSON.stringify(
          isMain
            ? {
                name,
                slug: slugify(name),
                branch_id: branchId,
                prep_station: prepStation,
              }
            : { name, slug: slugify(name), main_category_id: parentId }
        ),
      });
      setName("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: MainCategory | SubCategory) {
    setEditingId(row.id);
    setDraftName(row.name);
    if (isMain) {
      setDraftStation((row as MainCategory).prep_station ?? "kitchen");
    } else {
      setDraftParent((row as SubCategory).main_category_id);
    }
  }

  async function saveEdit(id: string) {
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`${path}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(
          isMain
            ? { name: draftName, slug: slugify(draftName), prep_station: draftStation }
            : { name: draftName, slug: slugify(draftName), main_category_id: draftParent }
        ),
      });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that change.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await apiFetch(`${path}/${id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that.");
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      {/* Create */}
      <form
        onSubmit={create}
        className="flex flex-wrap gap-3 rounded-xl border border-slate-bg bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      >
        {!isMain && (
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="h-10 rounded-lg border border-slate-border bg-white px-3 text-sm"
          >
            <option value="">Main category…</option>
            {mains.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}

        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isMain ? "e.g. Bar, Kitchen" : "e.g. Whisky, Desserts"}
          className="h-10 min-w-[180px] flex-1 border-slate-border"
        />

        {isMain && (
          <select
            value={prepStation}
            onChange={(e) => setPrepStation(e.target.value)}
            className="h-10 rounded-lg border border-slate-border bg-white px-3 text-sm"
          >
            <option value="kitchen">Prepared in the kitchen</option>
            <option value="bar">Prepared at the bar</option>
            <option value="none">No preparation needed</option>
          </select>
        )}

        <Button
          type="submit"
          disabled={saving}
          className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
        >
          <Plus size={16} className="mr-1.5" />
          {saving ? "Adding…" : "Add"}
        </Button>
      </form>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-muted">Nothing here yet.</p>
        ) : (
          <ul className="divide-y divide-slate-bg">
            {rows.map((row) => {
              const editing = editingId === row.id;

              if (editing) {
                return (
                  <li key={row.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="h-9 min-w-[160px] flex-1 border-slate-border"
                    />

                    {isMain ? (
                      <select
                        value={draftStation}
                        onChange={(e) => setDraftStation(e.target.value)}
                        className="h-9 rounded-lg border border-slate-border bg-white px-2.5 text-sm"
                      >
                        {STATIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={draftParent}
                        onChange={(e) => setDraftParent(e.target.value)}
                        className="h-9 rounded-lg border border-slate-border bg-white px-2.5 text-sm"
                      >
                        {mains.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      onClick={() => saveEdit(row.id)}
                      disabled={saving}
                      aria-label="Save"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald text-white disabled:opacity-60"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-muted hover:bg-slate-bg"
                    >
                      <X size={16} />
                    </button>
                  </li>
                );
              }

              return (
                <li key={row.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex-1 text-sm text-navy">{row.name}</span>

                  {isMain ? (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs ${
                        (row as MainCategory).prep_station === "bar"
                          ? "bg-purple-bg text-purple"
                          : (row as MainCategory).prep_station === "none"
                            ? "bg-slate-bg text-slate-subtle"
                            : "bg-info-bg text-info"
                      }`}
                    >
                      {STATIONS.find((s) => s.value === (row as MainCategory).prep_station)
                        ?.label ?? "Kitchen"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-purple-bg px-2.5 py-0.5 text-xs text-purple">
                      {mains.find((m) => m.id === (row as SubCategory).main_category_id)?.name ??
                        "—"}
                    </span>
                  )}

                  <button
                    onClick={() => startEdit(row)}
                    aria-label="Edit"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-muted hover:bg-info-bg hover:text-info"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => remove(row.id)}
                    aria-label="Remove"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-muted hover:bg-danger-bg hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}