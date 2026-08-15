"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MainCategory, SubCategory } from "./menu-browser";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            ? { name, slug: slugify(name), branch_id: branchId }
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
          className="h-10 flex-1 border-slate-border"
        />
        <Button
          type="submit"
          disabled={saving}
          className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
        >
          <Plus size={16} className="mr-1.5" />
          {saving ? "Adding…" : "Add"}
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-muted">
            Nothing here yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-bg">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="flex-1 text-sm text-navy">{row.name}</span>
                {!isMain && (
                  <span className="rounded-full bg-purple-bg px-2.5 py-0.5 text-xs text-purple">
                    {mains.find((m) => m.id === (row as SubCategory).main_category_id)?.name ?? "—"}
                  </span>
                )}
                <button
                  onClick={() => remove(row.id)}
                  aria-label="Remove"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-muted hover:bg-danger-bg hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}