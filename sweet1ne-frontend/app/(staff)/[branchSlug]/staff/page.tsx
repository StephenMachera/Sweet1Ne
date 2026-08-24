"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Plus, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { StaffForm, type StaffMember } from "@/components/staff/staff-form";
import { StaffDetail } from "@/components/staff/staff-detail";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Option = { id: string; name: string };

const ROLE_COLOURS = [
  "bg-info-bg text-info",
  "bg-success-bg text-success",
  "bg-warning-bg text-warning",
  "bg-purple-bg text-purple",
  "bg-emerald/12 text-emerald-dark",
  "bg-danger-bg text-danger",
];

const AVATAR_GRADIENTS = [
  "from-[#2563EB] to-[#1D4ED8]",
  "from-[#16A34A] to-[#15803D]",
  "from-[#CA8A04] to-[#A16207]",
  "from-[#7C3AED] to-[#6D28D9]",
  "from-[#10B981] to-[#059669]",
  "from-[#DC2626] to-[#B91C1C]",
];

function hashIndex(text: string, length: number) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % length;
}

const roleColour = (name: string) => ROLE_COLOURS[hashIndex(name, ROLE_COLOURS.length)];
const avatarGradient = (name: string) =>
  AVATAR_GRADIENTS[hashIndex(name, AVATAR_GRADIENTS.length)];

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

export default function BranchStaffPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [employmentFilter, setEmploymentFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const canManage = hasPermission(me, "manage_staff");
  const canViewPay = hasPermission(me, "view_staff_pay");

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) {
      router.replace(`/${branchSlug}/dashboard`);
      return;
    }

    Promise.all([apiFetch("/staff"), apiFetch("/roles")])
      .then(([staffList, roleList]) => {
        setStaff(staffList);
        setRoles(
          roleList
            .filter((r: any) => r.is_active && !r.is_super_admin)
            .map((r: any) => ({ id: r.id, name: r.name }))
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [meLoading, me, canManage, branchSlug, router]);

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

  if (meLoading || !me || !canManage) {
    return <p className="text-sm text-slate-muted">Loading…</p>;
  }

  const manageable = staff.filter((s) => !s.is_super_admin);

  const visible = manageable.filter((s) => {
    if (roleFilter && s.role_name !== roleFilter) return false;
    if (employmentFilter && s.employment_type !== employmentFilter) return false;
    return true;
  });

  const roleNames = Array.from(new Set(manageable.map((s) => s.role_name))).sort();
  const activeCount = manageable.filter((s) => s.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy sm:text-3xl">Staff</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-subtle">
            <span>
              {visible.length} of {manageable.length}{" "}
              {manageable.length === 1 ? "person" : "people"}
            </span>
            {manageable.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-0.5 text-xs text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {activeCount} active
              </span>
            )}
          </div>
        </div>

        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
        >
          <Plus size={16} className="mr-1.5" />
          Add staff
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger"
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
              ? "bg-navy text-white shadow-sm"
              : "border border-slate-border bg-white text-slate-subtle hover:text-navy"
          }`}
        >
          All roles
        </button>
        {roleNames.map((name) => (
          <button
            key={name}
            onClick={() => setRoleFilter(roleFilter === name ? "" : name)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
              roleFilter === name
                ? "bg-navy text-white shadow-sm"
                : `${roleColour(name)} hover:brightness-95`
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <select
        value={employmentFilter}
        onChange={(e) => setEmploymentFilter(e.target.value)}
        className="h-10 rounded-lg border border-slate-border bg-white px-3 text-sm text-navy"
      >
        <option value="">All employment types</option>
        {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-slate-bg bg-white p-4"
            >
              <div className="h-9 w-9 animate-pulse rounded-full bg-slate-bg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 animate-pulse rounded bg-slate-bg" />
                <div className="h-3 w-48 animate-pulse rounded bg-slate-bg" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-border bg-white/50 px-6 py-16 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-info-bg text-info">
            <Users size={22} />
          </span>
          <p className="mt-4 text-sm text-slate-muted">
            {manageable.length === 0
              ? "No staff at this branch yet. Add your first team member."
              : "No staff match these filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="hidden border-b border-slate-border bg-slate-bg/50 px-5 py-3 text-[11px] uppercase tracking-[0.12em] text-slate-muted md:grid md:grid-cols-[1.3fr_1.4fr_150px_110px_48px] md:gap-4">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span />
          </div>

          <ul className="divide-y divide-slate-bg">
            {visible.map((member) => {
              const expanded = expandedId === member.id;
              return (
                <li key={member.id} className={expanded ? "bg-slate-bg/30" : ""}>
                  <button
                    onClick={() => setExpandedId(expanded ? null : member.id)}
                    className="w-full px-5 py-4 text-left transition-colors hover:bg-slate-bg/40 md:grid md:grid-cols-[1.3fr_1.4fr_150px_110px_48px] md:items-center md:gap-4"
                  >
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
                      <span className="truncate text-sm font-medium text-navy">
                        {member.full_name ?? "—"}
                      </span>
                    </div>

                    <span className="truncate text-sm text-slate-subtle max-md:mt-2.5 max-md:block max-md:pl-12">
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

                    <span className="max-md:mt-2 max-md:block max-md:pl-12">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          member.is_active
                            ? "bg-success-bg text-success"
                            : "bg-danger-bg text-danger"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            member.is_active ? "bg-success" : "bg-danger"
                          }`}
                        />
                        {member.is_active ? "Active" : "Inactive"}
                      </span>
                    </span>

                    <span className="flex justify-end max-md:hidden">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                          expanded ? "bg-emerald text-white" : "bg-slate-bg text-slate-muted"
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
                      branches={[]}
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
            <DialogTitle className="text-xl font-semibold text-navy">Add staff member</DialogTitle>
          </DialogHeader>
          <StaffForm
            roles={roles}
            tone="branch"
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