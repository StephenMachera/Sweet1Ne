"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  RoleForm,
  groupByCategory,
  type Permission,
  type Role,
} from "@/components/staff/role-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminLoading } from "@/components/admin/admin-loading";

// The deactivate-confirmation dialog is portaled by @base-ui to
// document.body, outside .admin-shell — var(--x) tokens don't cascade
// there, so literal hex/rgba values are used instead (same fix as the
// other admin confirm dialogs; see menu/events/reservations/staff pages).
const DARK_DIALOG = "border border-[rgba(201,162,74,0.42)] bg-[#0c0c0c] text-[#e5e2e1] sm:max-w-md";
const DIALOG_BOOK_BTN =
  "inline-flex items-center justify-center rounded-[3px] border border-[rgba(201,162,74,0.9)] bg-transparent px-[1.15rem] py-[0.6rem] text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#c9a24a] hover:bg-[#c9a24a] hover:text-[#0e0e0e] disabled:opacity-50";
const DIALOG_GHOST_BTN =
  "px-[1.15rem] py-[0.6rem] text-[0.75rem] uppercase tracking-[0.1em] text-[rgba(229,226,225,0.68)] hover:text-[#e5e2e1]";

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
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

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
    <>
      <h1>Roles &amp; Permissions</h1>
      <p className="admin-dek">
        {roles.length} {roles.length === 1 ? "role" : "roles"}
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <div className="admin-tools">
        <button type="button" className="admin-book ml-auto" onClick={() => setDialogOpen(true)}>
          New role
        </button>
      </div>

      {loading ? (
        <AdminLoading />
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
                  className={`w-full rounded-[3px] border px-4 py-3.5 text-left transition-colors ${
                    active
                      ? "border-[var(--gold)] bg-[var(--panel)]"
                      : "border-[var(--gold-line)] bg-[var(--panel-2)] hover:bg-[var(--panel)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-medium ${
                        role.is_active ? "text-[var(--ivory)]" : "text-[var(--ivory-dim)]"
                      }`}
                    >
                      {role.name}
                    </span>
                    {role.is_super_admin && (
                      <ShieldCheck size={15} className="shrink-0 text-[var(--gold)]" />
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-[var(--ivory-dim)]">
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} />
                      {role.staff_count}
                    </span>
                    {!role.is_active && <span className="text-[var(--gold)]">Inactive</span>}
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Permission matrix */}
          <section className="overflow-hidden rounded-[3px] border border-[var(--gold-line)] bg-[var(--panel-2)]">
            {!selected ? (
              <p className="px-5 py-16 text-center text-sm text-[var(--ivory-dim)]">
                Select a role to view its permissions.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--gold-line)] px-5 py-4">
                  <div>
                    <h2 className="font-display text-lg text-[var(--ivory)]">{selected.name}</h2>
                    {selected.description && (
                      <p className="mt-0.5 text-sm text-[var(--ivory-dim)]">
                        {selected.description}
                      </p>
                    )}
                  </div>

                  {!selected.is_super_admin &&
                    (selected.is_active ? (
                      <button
                        onClick={() => setConfirmDeactivate(selected)}
                        className="admin-edit"
                      >
                        Deactivate role
                      </button>
                    ) : (
                      <button onClick={() => activate(selected)} className="admin-edit">
                        Reactivate role
                      </button>
                    ))}
                </div>

                {!selected.is_active && (
                  <div className="admin-hold border-b border-[var(--gold-line)] px-5 py-3 text-sm">
                    This role is inactive. Staff assigned to it can't sign in until it's
                    reactivated.
                  </div>
                )}

                {selected.is_super_admin ? (
                  <div className="flex items-start gap-3 px-5 py-6">
                    <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--gold)]" />
                    <div className="text-sm">
                      <p className="text-[var(--ivory)]">
                        This role has full access to everything.
                      </p>
                      <p className="mt-1 text-[var(--ivory-dim)]">
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
                          <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-[var(--ivory-dim)]">
                            {category}
                          </p>
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {permissions.map((p) => (
                              <label
                                key={p.id}
                                className="flex cursor-pointer items-center gap-3 text-sm text-[var(--ivory)]"
                              >
                                <Checkbox
                                  checked={draft.has(p.key)}
                                  onCheckedChange={() => toggle(p.key)}
                                />
                                <span>{p.display_name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {dirty && (
                      <div className="flex items-center justify-between gap-3 border-t border-[var(--gold-line)] bg-[var(--panel)] px-5 py-3.5">
                        <p className="text-sm text-[var(--ivory-dim)]">Unsaved changes</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="admin-edit"
                            onClick={() => selectRole(selected)}
                            disabled={saving}
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            className="admin-book"
                            onClick={savePermissions}
                            disabled={saving}
                          >
                            {saving ? "Saving…" : "Save changes"}
                          </button>
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

      {/* Create role — portaled into the third grid column owned by the
          shared /admin layout, same as menu, events, tables and staff.
          See #admin-drawer-slot in admin/layout.tsx. */}
      {dialogOpen &&
        drawerSlot &&
        createPortal(
          <aside className="admin-drawer-edit">
            <h2>New role</h2>
            <RoleForm
              allPermissions={allPermissions}
              tone="admin"
              onCreated={(role) => {
                setRoles((prev) => [...prev, role]);
                selectRole(role);
                setDialogOpen(false);
              }}
              onCancel={() => setDialogOpen(false)}
            />
          </aside>,
          drawerSlot
        )}

      {/* Deactivate confirmation */}
      <Dialog
        open={confirmDeactivate !== null}
        onOpenChange={(open) => !open && setConfirmDeactivate(null)}
      >
        <DialogContent className={DARK_DIALOG}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#e5e2e1]">
              Deactivate {confirmDeactivate?.name}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {confirmDeactivate && confirmDeactivate.staff_count > 0 ? (
              <div className="rounded-[3px] border border-[rgba(201,162,74,0.35)] bg-[#050505] px-4 py-3 text-sm text-[#c9a24a]">
                {confirmDeactivate.staff_count} active staff{" "}
                {confirmDeactivate.staff_count === 1 ? "member uses" : "members use"} this role.
                Deactivating it will immediately prevent{" "}
                {confirmDeactivate.staff_count === 1 ? "them" : "all of them"} from signing in
                until they're reassigned to another role.
              </div>
            ) : (
              <p className="text-sm text-[rgba(229,226,225,0.68)]">
                No staff currently use this role, so nobody will lose access.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" className={DIALOG_GHOST_BTN} onClick={() => setConfirmDeactivate(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={DIALOG_BOOK_BTN}
                onClick={() => confirmDeactivate && deactivate(confirmDeactivate)}
              >
                Deactivate
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}