"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldCheck, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  RoleForm,
  groupByCategory,
  type Permission,
  type Role,
} from "@/components/staff/role-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Role | null>(null);

  const selected = roles.find((r) => r.id === selectedId) ?? null;
  const grouped = groupByCategory(allPermissions);

  useEffect(() => {
    Promise.all([apiFetch("/roles"), apiFetch("/roles/permissions")])
      .then(([roleList, permissionList]) => {
        setRoles(roleList);
        setAllPermissions(permissionList);
        if (roleList.length > 0) selectRole(roleList[0]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function selectRole(role: Role) {
    setSelectedId(role.id);
    setDraft(new Set(role.permissions.map((p) => p.key)));
  }

  function toggle(key: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function savePermissions() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/roles/${selected.id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ name: selected.name, permission_keys: Array.from(draft) }),
      });
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(role: Role) {
    setConfirmDeactivate(null);
    setError(null);
    try {
      const updated = await apiFetch(`/roles/${role.id}/deactivate`, { method: "PATCH" });
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't deactivate the role.");
    }
  }

  async function activate(role: Role) {
    setError(null);
    try {
      const updated = await apiFetch(`/roles/${role.id}/activate`, { method: "PATCH" });
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reactivate the role.");
    }
  }

  const dirty =
    selected != null &&
    (draft.size !== selected.permissions.length ||
      selected.permissions.some((p) => !draft.has(p.key)));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink max-md:hidden">Roles &amp; Permissions</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {roles.length} {roles.length === 1 ? "role" : "roles"}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-gold text-ink hover:bg-gold/90">
          <Plus size={16} className="mr-1.5" />
          New role
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-ember/25 bg-ember/5 px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Role list */}
          <aside className="space-y-2">
            {roles.map((role) => {
              const active = role.id === selectedId;
              return (
                <button
                  key={role.id}
                  onClick={() => selectRole(role)}
                  className={`w-full rounded-lg border px-4 py-3.5 text-left transition-colors ${
                    active
                      ? "border-gold/50 bg-white shadow-[0_1px_2px_rgba(20,24,28,0.04)]"
                      : "border-ink/8 bg-white/60 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-medium ${role.is_active ? "text-ink" : "text-ink-muted"}`}>
                      {role.name}
                    </span>
                    {role.is_super_admin && <ShieldCheck size={15} className="shrink-0 text-gold" />}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} />
                      {role.staff_count}
                    </span>
                    {!role.is_active && <span className="text-ember">Inactive</span>}
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Permission matrix */}
          <section className="overflow-hidden rounded-lg border border-ink/8 bg-white">
            {!selected ? (
              <p className="px-5 py-16 text-center text-sm text-ink-muted">
                Select a role to view its permissions.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-5 py-4">
                  <div>
                    <h2 className="font-display text-lg text-ink">{selected.name}</h2>
                    {selected.description && (
                      <p className="mt-0.5 text-sm text-ink-muted">{selected.description}</p>
                    )}
                  </div>

                  {!selected.is_super_admin &&
                    (selected.is_active ? (
                      <button
                        onClick={() => setConfirmDeactivate(selected)}
                        className="text-sm text-ember underline underline-offset-4 hover:text-ember/80"
                      >
                        Deactivate role
                      </button>
                    ) : (
                      <button
                        onClick={() => activate(selected)}
                        className="text-sm text-sage underline underline-offset-4 hover:text-sage/80"
                      >
                        Reactivate role
                      </button>
                    ))}
                </div>

                {!selected.is_active && (
                  <div className="border-b border-ink/8 bg-ember/5 px-5 py-3 text-sm text-ember">
                    This role is inactive. Staff assigned to it can't sign in until it's
                    reactivated.
                  </div>
                )}

                {selected.is_super_admin ? (
                  <div className="flex items-start gap-3 px-5 py-6">
                    <ShieldCheck size={18} className="mt-0.5 shrink-0 text-gold" />
                    <div className="text-sm">
                      <p className="text-ink">This role has full access to everything.</p>
                      <p className="mt-1 text-ink-muted">
                        Permissions can't be edited — it automatically includes every permission,
                        including any added in future.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-5 px-5 py-5">
                      {Object.entries(grouped).map(([category, permissions]) => (
                        <div key={category}>
                          <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                            {category}
                          </p>
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {permissions.map((p) => (
                              <label
                                key={p.id}
                                className="flex cursor-pointer items-center gap-3 text-sm"
                              >
                                <Checkbox
                                  checked={draft.has(p.key)}
                                  onCheckedChange={() => toggle(p.key)}
                                />
                                <span className="text-ink">{p.display_name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {dirty && (
                      <div className="flex items-center justify-between gap-3 border-t border-ink/8 bg-[#F7F8FA] px-5 py-3.5">
                        <p className="text-sm text-ink-muted">Unsaved changes</p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectRole(selected)}
                            disabled={saving}
                          >
                            Discard
                          </Button>
                          <Button
                            size="sm"
                            onClick={savePermissions}
                            disabled={saving}
                            className="bg-gold text-ink hover:bg-gold/90"
                          >
                            {saving ? "Saving…" : "Save changes"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* Create role */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">New role</DialogTitle>
          </DialogHeader>
          <RoleForm
            allPermissions={allPermissions}
            onCreated={(role) => {
              setRoles((prev) => [...prev, role]);
              selectRole(role);
              setDialogOpen(false);
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation */}
      <Dialog
        open={confirmDeactivate !== null}
        onOpenChange={(open) => !open && setConfirmDeactivate(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Deactivate {confirmDeactivate?.name}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {confirmDeactivate && confirmDeactivate.staff_count > 0 ? (
              <div className="rounded-md border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-ember">
                {confirmDeactivate.staff_count} active staff{" "}
                {confirmDeactivate.staff_count === 1 ? "member uses" : "members use"} this role.
                Deactivating it will immediately prevent{" "}
                {confirmDeactivate.staff_count === 1 ? "them" : "all of them"} from signing in
                until they're reassigned to another role.
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                No staff currently use this role, so nobody will lose access.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => confirmDeactivate && deactivate(confirmDeactivate)}
                className="bg-ember text-white hover:bg-ember/90"
              >
                Deactivate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}