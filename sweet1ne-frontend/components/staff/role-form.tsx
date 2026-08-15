"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export type Permission = {
  id: string;
  key: string;
  display_name: string;
  category: string | null;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  is_super_admin: boolean;
  is_active: boolean;
  permissions: Permission[];
  staff_count: number;
};

export function groupByCategory(permissions: Permission[]) {
  return permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    const key = p.category ?? "other";
    (acc[key] ??= []).push(p);
    return acc;
  }, {});
}

export function RoleForm({
  allPermissions,
  onCreated,
  onCancel,
}: {
  allPermissions: Permission[];
  onCreated: (role: Role) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = groupByCategory(allPermissions);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const role = await apiFetch("/roles", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || null,
          permission_keys: Array.from(selected),
        }),
      });
      onCreated(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the role.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={saving} className="space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded-md border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-ember"
          >
            {error}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="roleName">Role name</Label>
          <Input
            id="roleName"
            required
            placeholder="e.g. Waiter, Head Chef, Cashier"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="roleDescription">Description</Label>
          <Input
            id="roleDescription"
            placeholder="Optional — what this role is for"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          <Label>Permissions</Label>
          {Object.entries(grouped).map(([category, permissions]) => (
            <div key={category} className="rounded-md border border-ink/8 p-4">
              <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                {category}
              </p>
              <div className="space-y-2.5">
                {permissions.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-3 text-sm">
                    <Checkbox
                      checked={selected.has(p.key)}
                      onCheckedChange={() => toggle(p.key)}
                    />
                    <span className="text-ink">{p.display_name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving} className="bg-gold text-ink hover:bg-gold/90">
            {saving ? "Creating…" : "Create role"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  );
}