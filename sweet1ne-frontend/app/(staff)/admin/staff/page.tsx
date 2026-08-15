"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Plus, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { StaffForm, type StaffMember } from "@/components/staff/staff-form";
import { StaffDetail } from "@/components/staff/staff-detail";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const BRANCH_KEY = "sweet1ne_staff_branch_filter";

type Option = { id: string; name: string };

const ROLE_COLOURS = [
  "bg-gold-soft text-[#8a6a28]",
  "bg-sage-soft text-[#4a5a40]",
  "bg-amber-soft text-[#8a5a1e]",
  "bg-teal-soft text-teal",
  "bg-violet-soft text-violet",
  "bg-rose-soft text-rose",
];

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

function roleColour(roleName: string) {
  return ROLE_COLOURS[hashIndex(roleName, ROLE_COLOURS.length)];
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

  const canViewPay = hasPermission(me, "view_staff_pay");

  useEffect(() => {
    setBranchFilter(window.localStorage.getItem(BRANCH_KEY) ?? "");
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
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink max-md:hidden">Staff</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span>
              {visible.length} of {manageable.length}{" "}
              {manageable.length === 1 ? "person" : "people"}
            </span>
            {manageable.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2.5 py-0.5 text-xs text-sage">
                <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                {activeCount} active
              </span>
            )}
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-gold text-ink hover:bg-gold/90">
          <Plus size={16} className="mr-1.5" />
          Add staff
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-ember/25 bg-ember-soft px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      )}

      {/* Role pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setRoleFilter("")}
          className={`rounded-full px-3.5 py-1.5 text-sm transition-all ${
            roleFilter === ""
              ? "bg-ink text-paper shadow-sm"
              : "border border-ink/12 bg-white text-ink-muted hover:border-ink/25 hover:text-ink"
          }`}
        >
          All roles
        </button>
        {roleNames.map((name) => {
          const active = roleFilter === name;
          return (
            <button
              key={name}
              onClick={() => setRoleFilter(active ? "" : name)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                active
                  ? "bg-ink text-paper shadow-sm"
                  : `${roleColour(name)} hover:brightness-95`
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* Dropdown filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={branchFilter}
          onChange={(e) => changeBranchFilter(e.target.value)}
          className="h-10 rounded-lg border border-ink/12 bg-white px-3 text-sm text-ink transition-colors hover:border-ink/25"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={employmentFilter}
          onChange={(e) => setEmploymentFilter(e.target.value)}
          className="h-10 rounded-lg border border-ink/12 bg-white px-3 text-sm text-ink transition-colors hover:border-ink/25"
        >
          <option value="">All employment types</option>
          {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-ink/8 bg-white p-4">
              <div className="h-9 w-9 animate-pulse rounded-full bg-ink/8" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 animate-pulse rounded bg-ink/8" />
                <div className="h-3 w-48 animate-pulse rounded bg-ink/5" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/15 bg-white/50 px-6 py-16 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-soft text-teal">
            <Users size={22} />
          </span>
          <p className="mt-4 text-sm text-ink-muted">
            {manageable.length === 0
              ? "No staff yet. Add your first team member to get started."
              : "No staff match these filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink/8 bg-white shadow-[0_1px_3px_rgba(20,24,28,0.04)]">
          {/* Desktop column headers */}
          <div className="hidden border-b border-ink/8 bg-[#FBFCFD] px-5 py-3 text-[11px] uppercase tracking-[0.12em] text-ink-muted md:grid md:grid-cols-[1.3fr_1.3fr_140px_130px_100px_48px] md:gap-4">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Branch</span>
            <span>Status</span>
            <span />
          </div>

          <ul className="divide-y divide-ink/5">
            {visible.map((member) => {
              const expanded = expandedId === member.id;
              return (
                <li key={member.id} className={expanded ? "bg-[#FBFCFD]" : ""}>
                  <button
                    onClick={() => setExpandedId(expanded ? null : member.id)}
                    className="w-full px-5 py-4 text-left transition-colors hover:bg-teal-soft/40 md:grid md:grid-cols-[1.3fr_1.3fr_140px_130px_100px_48px] md:items-center md:gap-4"
                  >
                    {/* Name + avatar */}
                    <div className="flex items-center gap-3">
                      {member.picture_url ? (
                        <img
                          src={member.picture_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white"
                        />
                      ) : (
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white ${avatarGradient(
                            member.role_name
                          )}`}
                        >
                          {initials(member.full_name, member.email)}
                        </span>
                      )}
                      <span className="truncate text-sm font-medium text-ink">
                        {member.full_name ?? "—"}
                      </span>
                    </div>

                    <span className="truncate text-sm text-ink-muted max-md:mt-2.5 max-md:block max-md:pl-12">
                      {member.email}
                    </span>

                    <span className="max-md:mt-2 max-md:block max-md:pl-12">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColour(
                          member.role_name
                        )}`}
                      >
                        {member.role_name}
                      </span>
                    </span>

                    <span className="truncate text-sm text-ink-muted max-md:mt-2 max-md:block max-md:pl-12">
                      {member.branch_slug ?? "All branches"}
                    </span>

                    <span className="max-md:mt-2 max-md:block max-md:pl-12">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          member.is_active
                            ? "bg-sage-soft text-sage"
                            : "bg-ember-soft text-ember"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            member.is_active ? "bg-sage" : "bg-ember"
                          }`}
                        />
                        {member.is_active ? "Active" : "Inactive"}
                      </span>
                    </span>

                    <span className="flex justify-end max-md:hidden">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                          expanded ? "bg-teal text-white" : "bg-ink/5 text-ink-muted"
                        }`}
                      >
                        {expanded ? <EyeOff size={15} /> : <Eye size={15} />}
                      </span>
                    </span>
                  </button>

                  {expanded && (
                    <StaffDetail
                      member={member}
                      canViewPay={canViewPay}
                      roles={roles}
                      branches={branches}
                      onUpdated={(updated) =>
                        setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
                      }
                      onDeactivate={toggleActive}
                      onClose={() => setExpandedId(null)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add staff member</DialogTitle>
          </DialogHeader>
          <StaffForm
            roles={roles}
            branches={branches}
            onCreated={(member) => {
              setStaff((prev) => [...prev, member]);
              setDialogOpen(false);
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}