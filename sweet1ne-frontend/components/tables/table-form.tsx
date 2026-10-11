"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { EmojiField } from "@/components/ui/emoji-field";

export type Table = {
id: string;
  branch_id: string;
  region: string | null;
  number: number;
  seats: number;
  qr_token?: string;
  qr_code_url?: string | null;
  is_active: boolean;
  order_mode?: string | null;
};

type Branch  = { id: string; name: string };

export function TableForm({
  table,
  branches,
  fixedBranchId,
  tone,
  onSaved,
  onCancel,
}: {
  table?: Table;
  branches?: Branch[];
  fixedBranchId?: string | null;
  tone: "admin" | "branch";
  onSaved: (table: Table) => void;
  onCancel: () => void;
}){
  // tone is kept on the prop for every caller — branch and admin now share
  // the one .admin-form look, so it's no longer read here.
  void tone;
  const [branchId, setBranchId] = useState(table?.branch_id ?? fixedBranchId ?? "");
  const [number, setNumber] = useState(table ? String(table.number) : "");
  const [seats, setSeats] = useState(table ? String(table.seats) : "2");
  const [region, setRegion] = useState(table?.region ?? "");
  const [orderMode, setOrderMode] = useState(table?.order_mode ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsBranchPick = !fixedBranchId && !table;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (needsBranchPick && !branchId) {
      setError("Please choose a branch.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        number: Number(number),
        seats: Number(seats),
        region: region || null,
        ...(table ? { order_mode: orderMode || null } : { branch_id: branchId || null }),
      };

      const saved = table
        ? await apiFetch(`/tables/${table.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : await apiFetch("/tables", { method: "POST", body: JSON.stringify(body) });

      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this table.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      <fieldset disabled={saving} className="contents">
        {error && (
          <p role="alert" className="admin-hold mb-3 text-sm">
            {error}
          </p>
        )}

        {needsBranchPick && branches && (
          <label>
            Branch
            <select required value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Choose a branch…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="admin-row">
          <label>
            Table number
            <input type="number" min="1" required value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <label>
            Seats
            <input type="number" min="1" required value={seats} onChange={(e) => setSeats(e.target.value)} />
          </label>
        </div>

        <label>
          Area
          <EmojiField
            value={region}
            onChange={setRegion}
            placeholder="e.g. Patio, Main floor, Bar"
          />
        </label>

        {table && (
          <label>
            How this table orders
            <select value={orderMode} onChange={(e) => setOrderMode(e.target.value)}>
              <option value="">Same as restaurant</option>
              <option value="waiter">Ask a waiter</option>
              <option value="app">Order on the phone</option>
            </select>
          </label>
        )}

        <div className="flex gap-3 pt-1">
          <button type="submit" className="admin-book" disabled={saving}>
            {saving ? "Saving…" : table ? "Save changes" : "Create table"}
          </button>
          <button type="button" className="admin-book" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
