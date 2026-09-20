"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const isBranch = tone === "branch";
  const [branchId, setBranchId] = useState(table?.branch_id ?? fixedBranchId ?? "");
  const [number, setNumber] = useState(table ? String(table.number) : "");
  const [seats, setSeats] = useState(table ? String(table.seats) : "2");
  const [region, setRegion] = useState(table?.region ?? "");
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
        ...(table ? {} : { branch_id: branchId || null }),
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

  if (isBranch) {
    return (
      <form onSubmit={handleSubmit}>
        <fieldset disabled={saving} className="space-y-5">
          {error && (
            <div role="alert" className="rounded-lg px-4 py-3 text-sm border border-danger/25 bg-danger-bg text-danger">
              {error}
            </div>
          )}

          {needsBranchPick && branches && (
            <div className="space-y-1">
              <Label htmlFor="t-branch">Branch</Label>
              <select
                id="t-branch"
                required
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm"
              >
                <option value="">Choose a branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-muted">
                A table belongs to one branch and can't be moved later.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="t-number">Table number</Label>
              <Input
                id="t-number"
                type="number"
                min="1"
                required
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="border-slate-border"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-seats">Seats</Label>
              <Input
                id="t-seats"
                type="number"
                min="1"
                required
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className="border-slate-border"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="t-region">Area</Label>
            <Input
              id="t-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Patio, Main floor, Bar"
              className="border-slate-border"
            />
            <p className="text-xs text-slate-muted">
              Printed on the QR code so staff can tell tables apart.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
            >
              {saving ? "Saving…" : table ? "Save changes" : "Create table"}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </fieldset>
      </form>
    );
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
