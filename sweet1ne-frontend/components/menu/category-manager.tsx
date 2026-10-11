"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { slugify } from "@/lib/utils";
import { CoursePictureDialog } from "./course-picture-dialog";
import type { MainCategory, SubCategory } from "./menu-browser";

const STATIONS = [
  { value: "kitchen", label: "Kitchen" },
  { value: "bar", label: "Bar" },
  { value: "none", label: "No prep" },
];

export function CategoryManager({
  tone,
  level,
  mains,
  subs,
  onChanged,
  branchId = null,
}: {
  tone: "admin" | "branch";
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
  const [pictureFor, setPictureFor] = useState<MainCategory | null>(null);

  // tone is kept on the prop for every caller — branch and admin now share
  // the one .admin-sheet look, so it's no longer read here.
  void tone;
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
    <div>
      {error && (
        <p role="alert" className="admin-hold mb-3 text-sm">
          {error}
        </p>
      )}

      {/* Create */}
      <form onSubmit={create} className="admin-tools">
        {!isMain && (
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Main category…</option>
            {mains.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}

        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isMain ? "e.g. Bar, Kitchen" : "e.g. Whisky, Desserts"}
        />

        {isMain && (
          <select value={prepStation} onChange={(e) => setPrepStation(e.target.value)}>
            <option value="kitchen">Prepared in the kitchen</option>
            <option value="bar">Prepared at the bar</option>
            <option value="none">No preparation needed</option>
          </select>
        )}

        <button type="submit" className="admin-book" disabled={saving}>
          <Plus size={14} className="-mt-0.5 mr-1 inline" />
          {saving ? "Adding…" : "Add"}
        </button>
      </form>

      {/* List */}
      <div className="admin-data-panel">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-[var(--ivory-dim)]">Nothing here yet.</p>
        ) : (
          <table className="admin-sheet">
            <tbody>
              {rows.map((row) => {
                const editing = editingId === row.id;

                if (editing) {
                  return (
                    <tr key={row.id}>
                      {isMain && (
                        <td>
                          <button
                            type="button"
                            className={`admin-menu-mark is-small${(row as MainCategory).picture ? "" : " is-empty"}`}
                            aria-label={`Change ${row.name} picture`}
                            onClick={() => setPictureFor(row as MainCategory)}
                          >
                            {(row as MainCategory).picture && (
                              <img src={(row as MainCategory).picture!} alt="" />
                            )}
                          </button>
                        </td>
                      )}
                      <td>
                        <input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                        />
                      </td>
                      <td>
                        {isMain ? (
                          <select value={draftStation} onChange={(e) => setDraftStation(e.target.value)}>
                            {STATIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select value={draftParent} onChange={(e) => setDraftParent(e.target.value)}>
                            {mains.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => saveEdit(row.id)}
                          disabled={saving}
                          aria-label="Save"
                          className="admin-edit"
                        >
                          <Check size={15} />
                        </button>
                      </td>
                      <td>
                        <button onClick={() => setEditingId(null)} aria-label="Cancel" className="admin-edit">
                          <X size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={row.id}>
                    {isMain && (
                      <td>
                        <button
                          type="button"
                          className={`admin-menu-mark is-small${(row as MainCategory).picture ? "" : " is-empty"}`}
                          aria-label={`Change ${row.name} picture`}
                          onClick={() => setPictureFor(row as MainCategory)}
                        >
                          {(row as MainCategory).picture && (
                            <img src={(row as MainCategory).picture!} alt="" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="admin-name">{row.name}</td>
                    <td className="admin-muted">
                      {isMain
                        ? STATIONS.find((s) => s.value === (row as MainCategory).prep_station)?.label ??
                          "Kitchen"
                        : mains.find((m) => m.id === (row as SubCategory).main_category_id)?.name ?? "—"}
                    </td>
                    <td>
                      <button onClick={() => startEdit(row)} aria-label="Edit" className="admin-edit">
                        <Pencil size={15} />
                      </button>
                    </td>
                    <td>
                      <button onClick={() => remove(row.id)} aria-label="Remove" className="admin-edit">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isMain && (
        <CoursePictureDialog
          category={pictureFor}
          onClose={() => setPictureFor(null)}
          onSaved={() => onChanged()}
        />
      )}
    </div>
  );
}
