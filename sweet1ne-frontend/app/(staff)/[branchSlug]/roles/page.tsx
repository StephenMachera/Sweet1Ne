"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import {
  RoleForm,
  groupByCategory,
  type Permission,
  type Role,
} from "@/components/staff/role-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function BranchRolesPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Role | null>(null);

  const canManage = hasPermission(me, "manage_roles");
  const selected = roles.find((r) => r.id === selectedId) ?? null;
  const grouped = groupByCategory(allPermissions);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) {
      router.replace(`/${branchSlug}/dashboard`);
      return;
    }

    Promise.all([apiFetch("/roles"), apiFetch("/roles/permissions")])
      .then(([roleList, permissionList]) => {
        setRoles(roleList);
        setAllPermissions(permissionList);
        if (roleList.length > 0) selectRole(roleList[0]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [meLoading, me, canManage, branchSlug, router]);

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

  if (meLoading || !me || !canManage) {
    return <p className="text-sm text-slate-muted">Loading…</p>;
  }

  const dirty =
    selected != null &&
    (draft.size !== selected.permissions.length ||
      selected.permissions.some((p) => !draft.has(p.key)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy sm:text-3xl">Roles &amp; Permissions</h1>
          <p className="mt-1 text-sm text-slate-subtle">
            {roles.length} {roles.length === 1 ? "role" : "roles"} · shared across every branch
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
        >
          <Plus size={16} className="mr-1.5" />
          New role
        </Button>
      </div>

      <div className="rounded-xl border border-warning/25 bg-warning-bg px-4 py-3 text-sm text-warning">
        Roles apply to the whole company. Changing one affects staff at every branch.
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-muted">Loading…</p>
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
                  className={`w-full rounded-xl border px-4 py-3.5 text-left transition-colors ${
                    active
                      ? "border-emerald/50 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                      : "border-slate-bg bg-white/60 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-medium ${role.is_active ? "text-navy" : "text-slate-muted"}`}
                    >
                      {role.name}
                    </span>
                    {role.is_super_admin && (
                      <ShieldCheck size={15} className="shrink-0 text-emerald" />
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-muted">
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} />
                      {role.staff_count}
                    </span>
                    {!role.is_active && <span className="text-danger">Inactive</span>}
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Permission matrix */}
          <section className="overflow-hidden rounded-xl border border-slate-bg bg-white">
            {!selected ? (
              <p className="px-5 py-16 text-center text-sm text-slate-muted">
                Select a role to view its permissions.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-border px-5 py-4">
                  <div>
                    <h2 className="font-semibold text-navy">{selected.name}</h2>
                    {selected.description && (
                      <p className="mt-0.5 text-sm text-slate-subtle">{selected.description}</p>
                    )}
                  </div>

                  {!selected.is_super_admin &&
                    (selected.is_active ? (
                      <button
                        onClick={() => setConfirmDeactivate(selected)}
                        className="text-sm text-danger underline underline-offset-4"
                      >
                        Deactivate role
                      </button>
                    ) : (
                      <button
                        onClick={() => activate(selected)}
                        className="text-sm text-success underline underline-offset-4"
                      >
                        Reactivate role
                      </button>
                    ))}
                </div>

                {!selected.is_active && (
                  <div className="border-b border-slate-border bg-danger-bg px-5 py-3 text-sm text-danger">
                    This role is inactive. Staff assigned to it can't sign in until it's
                    reactivated.
                  </div>
                )}

                {selected.is_super_admin ? (
                  <div className="flex items-start gap-3 px-5 py-6">
                    <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald" />
                    <div className="text-sm">
                      <p className="text-navy">This role has full access to everything.</p>
                      <p className="mt-1 text-slate-subtle">
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
                          <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-muted">
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
                                <span className="text-body">{p.display_name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {dirty && (
                      <div className="flex items-center justify-between gap-3 border-t border-slate-border bg-slate-bg/50 px-5 py-3.5">
                        <p className="text-sm text-slate-subtle">Unsaved changes</p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectRole(selected)}
                            disabled={saving}
                            className="border-slate-border"
                          >
                            Discard
                          </Button>
                          <Button
                            size="sm"
                            onClick={savePermissions}
                            disabled={saving}
                            className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
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
            <DialogTitle className="text-xl font-semibold text-navy">New role</DialogTitle>
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
            <DialogTitle className="text-xl font-semibold text-navy">
              Deactivate {confirmDeactivate?.name}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {confirmDeactivate && confirmDeactivate.staff_count > 0 ? (
              <div className="rounded-lg border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger">
                {confirmDeactivate.staff_count} active staff{" "}
                {confirmDeactivate.staff_count === 1 ? "member uses" : "members use"} this role
                across every branch. Deactivating it will immediately prevent them from signing in.
              </div>
            ) : (
              <p className="text-sm text-slate-subtle">
                No staff currently use this role, so nobody will lose access.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmDeactivate(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => confirmDeactivate && deactivate(confirmDeactivate)}
                className="bg-danger text-white hover:bg-danger/90"
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