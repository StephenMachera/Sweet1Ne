"use client";

import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { StaffForm, type StaffMember } from "@/components/staff/staff-form";
import { StaffDetail } from "@/components/staff/staff-detail";

const BRANCH_KEY = "sweet1ne_staff_branch_filter";

type Option = { id: string; name: string };

const AVATAR_GRADIENTS = [
  "from-[#D4A853] to-[#B8873D]",
  "from-[#6B7F5E] to-[#4A5A40]",
  "from-[#E0913A] to-[#C4703E]",
  "from-[#4A7C7E] to-[#2F7D7F]",
  "from-[#7A5C8E] to-[#6B5B95]",
  "from-[#B8496B] to-[#8E3A55]",
];

function hashIndex(text: string, length: number) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % length;
}

function avatarGradient(roleName: string) {
  return AVATAR_GRADIENTS[hashIndex(roleName, AVATAR_GRADIENTS.length)];
}

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  casual: "Casual",
  zero_hours: "Zero hours",
};

export default function StaffPage() {
  const { me } = useMe();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [employmentFilter, setEmploymentFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  const canViewPay = hasPermission(me, "view_staff_pay");

  useEffect(() => {
    setBranchFilter(window.localStorage.getItem(BRANCH_KEY) ?? "");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

  useEffect(() => {
    Promise.all([apiFetch("/staff"), apiFetch("/roles"), apiFetch("/branches")])
      .then(([staffList, roleList, branchList]) => {
        setStaff(staffList);
        setRoles(
          roleList
            .filter((r: any) => r.is_active && !r.is_super_admin)
            .map((r: any) => ({ id: r.id, name: r.name }))
        );
        setBranches(branchList.map((b: any) => ({ id: b.id, name: b.name })));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function changeBranchFilter(value: string) {
    setBranchFilter(value);
    window.localStorage.setItem(BRANCH_KEY, value);
  }

  async function toggleActive(member: StaffMember) {
    const action = member.is_active ? "deactivate" : "activate";
    setError(null);
    try {
      const updated = await apiFetch(`/staff/${member.id}/${action}`, { method: "PATCH" });
      setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Couldn't ${action} this staff member.`);
    }
  }

  // Directors are managed separately, not through this table.
  const manageable = staff.filter((s) => !s.is_super_admin);

  const visible = manageable.filter((s) => {
    if (branchFilter && s.branch_id !== branchFilter) return false;
    if (roleFilter && s.role_name !== roleFilter) return false;
    if (employmentFilter && s.employment_type !== employmentFilter) return false;
    return true;
  });

  const roleNames = Array.from(new Set(manageable.map((s) => s.role_name))).sort();
  const activeCount = manageable.filter((s) => s.is_active).length;

  return (
    <>
      <div className="admin-top">
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Staff</h1>
      <p className="admin-dek">
        {visible.length} of {manageable.length} {manageable.length === 1 ? "person" : "people"}
        {manageable.length > 0 ? ` · ${activeCount} active` : ""}
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <div className="admin-tools">
        <button type="button" className="admin-book ml-auto" onClick={() => setDialogOpen(true)}>
          Add staff
        </button>
      </div>

      {/* Role pills */}
      <div className="admin-cats" role="group" aria-label="Role">
        <button
          type="button"
          className={roleFilter === "" ? "is-on" : undefined}
          onClick={() => setRoleFilter("")}
        >
          All roles
        </button>
        {roleNames.map((name) => (
          <button
            key={name}
            type="button"
            className={roleFilter === name ? "is-on" : undefined}
            onClick={() => setRoleFilter(roleFilter === name ? "" : name)}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Dropdown filters */}
      <div className="admin-tools">
        <select value={branchFilter} onChange={(e) => changeBranchFilter(e.target.value)}>
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select value={employmentFilter} onChange={(e) => setEmploymentFilter(e.target.value)}>
          <option value="">All employment types</option>
          {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--ivory-dim)]">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="admin-empty">
          {manageable.length === 0
            ? "No staff yet. Add your first team member to get started."
            : "No staff match these filters."}
        </p>
      ) : (
        <div className="admin-data-panel">
          <table className="admin-sheet">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((member) => {
                const expanded = expandedId === member.id;
                return (
                  <Fragment key={member.id}>
                    <tr
                      className="cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : member.id)}
                    >
                      <td className="admin-pic">
                        {member.picture_url ? (
                          <img src={member.picture_url} alt="" />
                        ) : (
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white ${avatarGradient(
                              member.role_name
                            )}`}
                          >
                            {initials(member.full_name, member.email)}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="admin-name">{member.full_name ?? "—"}</span>
                      </td>
                      <td className="admin-muted">{member.email}</td>
                      <td className="admin-muted">{member.role_name}</td>
                      <td className="admin-muted">{member.branch_slug ?? "All branches"}</td>
                      <td>
                        <span className={`admin-status${member.is_active ? " is-ok" : ""}`}>
                          {member.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <span className="admin-edit">
                          {expanded ? <EyeOff size={15} /> : <Eye size={15} />}
                        </span>
                      </td>
                    </tr>

                    {expanded && (
                      <tr>
                        <td colSpan={7}>
                          <StaffDetail
                            member={member}
                            canViewPay={canViewPay}
                            roles={roles}
                            branches={branches}
                            tone="admin"
                            onUpdated={(updated) =>
                              setStaff((prev) =>
                                prev.map((s) => (s.id === updated.id ? updated : s))
                              )
                            }
                            onDeactivate={toggleActive}
                            onClose={() => setExpandedId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor — portaled into the third grid column owned by the shared
          /admin layout, same as menu, events and tables. See
          #admin-drawer-slot in admin/layout.tsx. */}
      {dialogOpen &&
        drawerSlot &&
        createPortal(
          <aside className="admin-drawer-edit">
            <h2>Add staff member</h2>
            <StaffForm
              roles={roles}
              branches={branches}
              tone="admin"
              onCreated={(member) => {
                setStaff((prev) => [...prev, member]);
                setDialogOpen(false);
              }}
              onCancel={() => setDialogOpen(false)}
            />
          </aside>,
          drawerSlot
        )}
    </>
  );
}