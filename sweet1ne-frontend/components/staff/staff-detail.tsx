"use client";

import { useState } from "react";
import {
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  StickyNote,
  UserRound,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StaffMember } from "./staff-form";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "casual", label: "Casual" },
  { value: "zero_hours", label: "Zero hours" },
];

type Option = { id: string; name: string };

const AVATAR_GRADIENTS = [
  "from-[#D4A853] to-[#B8873D]",
  "from-[#6B7F5E] to-[#4A5A40]",
  "from-[#E0913A] to-[#C4703E]",
  "from-[#4A7C7E] to-[#2F7D7F]",
  "from-[#7A5C8E] to-[#6B5B95]",
  "from-[#B8496B] to-[#8E3A55]",
];

function avatarGradient(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Field({
  icon: Icon,
  label,
  value,
  tone = "ink",
}: {
  icon: any;
  label: string;
  value: string | null | undefined;
  tone?: "ink" | "teal" | "violet" | "rose" | "sage" | "gold";
}) {
  const tones: Record<string, string> = {
    ink: "bg-ink/5 text-ink-muted",
    teal: "bg-teal-soft text-teal",
    violet: "bg-violet-soft text-violet",
    rose: "bg-rose-soft text-rose",
    sage: "bg-sage-soft text-sage",
    gold: "bg-gold-soft text-[#8a6a28]",
  };

  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">{label}</p>
        <p className="mt-0.5 break-words text-sm text-ink">{value || "—"}</p>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink/8 bg-white">
      <div className={`border-b border-ink/6 px-4 py-2.5 ${accent}`}>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em]">{title}</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function StaffDetail({
  member,
  canViewPay,
  roles,
  branches,
  onUpdated,
  onDeactivate,
  onClose,
}: {
  member: StaffMember;
  canViewPay: boolean;
  roles: Option[];
  branches: Option[];
  onUpdated: (member: StaffMember) => void;
  onDeactivate: (member: StaffMember) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: any) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function value(field: keyof StaffMember) {
    return draft[field] ?? member[field] ?? "";
  }

  function dateValue(field: keyof StaffMember) {
    const raw = draft[field] ?? member[field];
    return raw ? String(raw).slice(0, 10) : "";
  }

  const currentPicture = draft.picture_url ?? member.picture_url;

  async function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/uploads/images?folder=staff`, {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Upload failed.");
      }

      const { url } = await res.json();
      set("picture_url", url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/staff/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      onUpdated(updated);
      setDraft({});
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-ink/8 bg-gradient-to-b from-[#F7F9FB] to-white px-5 py-6">
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-ember/30 bg-ember-soft px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      )}

      {/* ---- Profile header ---- */}
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <div className="relative">
          {currentPicture ? (
            <img
              src={currentPicture}
              alt=""
              className="h-24 w-24 rounded-full object-cover ring-4 ring-white shadow-md"
            />
          ) : (
            <span
              className={`flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br text-2xl font-semibold text-white shadow-md ring-4 ring-white ${avatarGradient(
                member.role_name
              )}`}
            >
              {initials(member.full_name, member.email)}
            </span>
          )}

          {editing && (
            <>
              <label
                htmlFor={`pic-${member.id}`}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-teal text-white shadow-md ring-2 ring-white transition-colors hover:bg-teal/90"
                title="Change photo"
              >
                <Camera size={16} />
              </label>
              <input
                id={`pic-${member.id}`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePictureChange}
                className="hidden"
              />
            </>
          )}

          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/50 text-[10px] text-white">
              Uploading…
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl text-ink">{member.full_name ?? member.email}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-soft px-2.5 py-0.5 text-xs font-medium text-violet">
              {member.role_name}
            </span>
            <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-medium text-teal">
              {member.branch_slug ?? "All branches"}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                member.is_active ? "bg-sage-soft text-sage" : "bg-ember-soft text-ember"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${member.is_active ? "bg-sage" : "bg-ember"}`}
              />
              {member.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button
                size="sm"
                onClick={save}
                disabled={saving || uploading}
                className="bg-sage text-white hover:bg-sage/90"
              >
                <Check size={15} className="mr-1.5" />
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft({});
                  setEditing(false);
                }}
                className="text-ink-muted hover:text-ink"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => setEditing(true)}
                className="bg-teal text-white hover:bg-teal/90"
              >
                <Pencil size={14} className="mr-1.5" />
                Edit
              </Button>
              <Button
                size="sm"
                onClick={() => onDeactivate(member)}
                className={
                  member.is_active
                    ? "bg-ember-soft text-ember hover:bg-ember/15"
                    : "bg-sage-soft text-sage hover:bg-sage/15"
                }
              >
                {member.is_active ? "Deactivate" : "Reactivate"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="text-ink-muted hover:text-ink"
              >
                <X size={16} />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ---- Body ---- */}
      {editing ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-ink/8 bg-white">
            <div className="border-b border-ink/6 bg-teal-soft px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-teal">
              Personal & contact
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="d-name">Full name</Label>
                <Input id="d-name" value={value("full_name")} onChange={(e) => set("full_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-phone">Phone</Label>
                <Input id="d-phone" value={value("phone")} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-ec-name">Emergency contact</Label>
                <Input
                  id="d-ec-name"
                  value={value("emergency_contact_name")}
                  onChange={(e) => set("emergency_contact_name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-ec-phone">Emergency phone</Label>
                <Input
                  id="d-ec-phone"
                  value={value("emergency_contact_phone")}
                  onChange={(e) => set("emergency_contact_phone", e.target.value)}
                />
              </div>
              {canViewPay && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="d-dob">Date of birth</Label>
                    <Input
                      id="d-dob"
                      type="date"
                      value={value("date_of_birth")}
                      onChange={(e) => set("date_of_birth", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="d-address">Address</Label>
                    <Input id="d-address" value={value("address")} onChange={(e) => set("address", e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-ink/8 bg-white">
            <div className="border-b border-ink/6 bg-violet-soft px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-violet">
              Employment
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="d-employment">Employment type</Label>
                <select
                  id="d-employment"
                  value={value("employment_type")}
                  onChange={(e) => set("employment_type", e.target.value)}
                  className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm"
                >
                  <option value="">Not set</option>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-shift">Shift pattern</Label>
                <Input
                  id="d-shift"
                  placeholder="e.g. Mon–Fri evenings"
                  value={value("shift_pattern")}
                  onChange={(e) => set("shift_pattern", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-hire-date">Start date</Label>
                <Input
                  id="d-hire-date"
                  type="date"
                  value={dateValue("hire_date")}
                  onChange={(e) => set("hire_date", e.target.value || null)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-role">Role</Label>
                <select
                  id="d-role"
                  value={value("role_id")}
                  onChange={(e) => set("role_id", e.target.value)}
                  className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-branch">Branch</Label>
                <select
                  id="d-branch"
                  value={value("branch_id")}
                  onChange={(e) => set("branch_id", e.target.value || null)}
                  className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm"
                >
                  <option value="">All branches (director level)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              {canViewPay && (
                <div className="flex items-center gap-3 pt-6">
                  <input
                    id="d-rtw"
                    type="checkbox"
                    checked={Boolean(draft.right_to_work_verified ?? member.right_to_work_verified)}
                    onChange={(e) => set("right_to_work_verified", e.target.checked)}
                    className="h-4 w-4 accent-[#2f7d7f]"
                  />
                  <Label htmlFor="d-rtw" className="cursor-pointer">
                    Right to work verified
                  </Label>
                </div>
              )}
            </div>
          </div>

          {canViewPay && (
            <div className="overflow-hidden rounded-xl border border-ink/8 bg-white">
              <div className="border-b border-ink/6 bg-gold-soft px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a6a28]">
                Pay & records
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="d-salary">Pay</Label>
                  <Input
                    id="d-salary"
                    type="number"
                    step="0.01"
                    value={value("salary")}
                    onChange={(e) => set("salary", e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="d-paytype">Pay type</Label>
                  <select
                    id="d-paytype"
                    value={value("pay_type")}
                    onChange={(e) => set("pay_type", e.target.value)}
                    className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm"
                  >
                    <option value="">Not set</option>
                    <option value="hourly">Hourly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="d-ni">National Insurance no.</Label>
                  <Input
                    id="d-ni"
                    value={value("national_insurance_number")}
                    onChange={(e) => set("national_insurance_number", e.target.value.toUpperCase())}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                  <Label htmlFor="d-notes">Notes</Label>
                  <Input id="d-notes" value={value("notes")} onChange={(e) => set("notes", e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Personal & contact" accent="bg-teal-soft text-teal">
            <Field icon={Mail} label="Email" value={member.email} tone="teal" />
            <Field icon={Phone} label="Phone" value={member.phone} tone="teal" />
            <Field
              icon={UserRound}
              label="Emergency contact"
              value={member.emergency_contact_name}
              tone="rose"
            />
            <Field
              icon={Phone}
              label="Emergency phone"
              value={member.emergency_contact_phone}
              tone="rose"
            />
            {canViewPay && (
              <>
                <Field
                  icon={CalendarDays}
                  label="Date of birth"
                  value={
                    member.date_of_birth
                      ? new Date(member.date_of_birth).toLocaleDateString("en-GB")
                      : null
                  }
                />
                <Field icon={MapPin} label="Address" value={member.address} />
              </>
            )}
          </SectionCard>

          <SectionCard title="Employment" accent="bg-violet-soft text-violet">
            <Field
              icon={BriefcaseBusiness}
              label="Type"
              value={EMPLOYMENT_TYPES.find((t) => t.value === member.employment_type)?.label}
              tone="violet"
            />
            <Field icon={CalendarDays} label="Shift pattern" value={member.shift_pattern} tone="violet" />
            <Field
              icon={CalendarDays}
              label="Started"
              value={member.hire_date ? new Date(member.hire_date).toLocaleDateString("en-GB") : null}
              tone="violet"
            />
            <Field icon={MapPin} label="Branch" value={member.branch_slug ?? "All branches"} tone="violet" />
          </SectionCard>

          {canViewPay && (
            <SectionCard title="Pay & records" accent="bg-gold-soft text-[#8a6a28]">
              <Field
                icon={Banknote}
                label="Pay"
                value={
                  member.salary != null
                    ? `${gbp.format(member.salary)}${
                        member.pay_type === "hourly"
                          ? " / hr"
                          : member.pay_type === "annual"
                            ? " / yr"
                            : ""
                      }`
                    : null
                }
                tone="sage"
              />
              <Field
                icon={StickyNote}
                label="NI number"
                value={member.national_insurance_number}
                tone="gold"
              />

              <div className="flex items-start gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    member.right_to_work_verified
                      ? "bg-sage-soft text-sage"
                      : "bg-ember-soft text-ember"
                  }`}
                >
                  <ShieldCheck size={15} />
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                    Right to work
                  </p>
                  <p
                    className={`mt-0.5 text-sm font-medium ${
                      member.right_to_work_verified ? "text-sage" : "text-ember"
                    }`}
                  >
                    {member.right_to_work_verified ? "Verified" : "Not verified"}
                  </p>
                </div>
              </div>

              <Field icon={StickyNote} label="Notes" value={member.notes} tone="gold" />
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}