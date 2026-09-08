"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type StaffMember = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  picture_url: string | null;
  employment_type: string | null;
  shift_pattern: string | null;
  hire_date: string | null;
  is_active: boolean;
  role_name: string;
  role_id?: string | null;
  is_super_admin: boolean;
  branch_id: string | null;
  branch_slug: string | null;

  // Only present when the caller has view_staff_pay
  date_of_birth?: string | null;
  address?: string | null;
  national_insurance_number?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  right_to_work_verified?: boolean;
  salary?: number | null;
  pay_type?: string | null;
  notes?: string | null;
};

type Option = { id: string; name: string };

const MIN_PASSWORD_LENGTH = 8;

export function StaffForm({
  roles,
  branches,
  tone = "admin",
  onCreated,
  onCancel,
}: {
  roles: Option[];
  /** Omitted at branch level — a manager can only add staff to their own branch. */
  branches?: Option[];
  tone?: "admin" | "branch";
  onCreated: (staff: StaffMember) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [sendInvite, setSendInvite] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBranch = tone === "branch";

  const primaryButton = isBranch
    ? "bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
    : "bg-gold text-ink hover:bg-gold/90";
  const errorBox = isBranch
    ? "border border-danger/25 bg-danger-bg text-danger"
    : "border border-ember/25 bg-ember-soft text-ember";
  const hintText = isBranch ? "text-slate-muted" : "text-ink-muted";
  const selectBorder = isBranch ? "border-slate-border" : "border-ink/15";
  const panelBorder = isBranch ? "border-slate-border" : "border-ink/10";

  const passwordTooShort =
    !sendInvite && password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!roleId) {
      setError("Please choose a role.");
      return;
    }
    if (!sendInvite && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    try {
      const created = await apiFetch("/staff", {
        method: "POST",
        body: JSON.stringify({
          email,
          full_name: fullName || null,
          phone: phone || null,
          role_id: roleId,
          // Branch-level callers send nothing — the backend uses their own
          // branch. Only a director picks one (or leaves it null).
          ...(branches ? { branch_id: branchId || null } : {}),
          send_invite: sendInvite,
          password: sendInvite ? null : password,
        }),
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create this staff member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={saving} className="space-y-6">
        {error && (
          <div role="alert" className={`rounded-md px-4 py-3 text-sm ${errorBox}`}>
            {error}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="staffEmail">Email</Label>
          <Input
            id="staffEmail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={selectBorder}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="staffName">Full name</Label>
          <Input
            id="staffName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={selectBorder}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="staffPhone">Phone</Label>
          <Input
            id="staffPhone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={selectBorder}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="staffRole">Role</Label>

          {roles.length === 0 ? (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                isBranch
                  ? "border-warning/30 bg-warning-bg text-warning"
                  : "border-gold/30 bg-gold-soft text-[#8a6a28]"
              }`}
            >
              No roles have been set up yet. Ask your director to create one before adding staff.
            </div>
          ) : (
            <>
              <select
                id="staffRole"
                required
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className={`h-10 w-full rounded-lg border bg-white px-3 text-sm ${selectBorder}`}
              >
                <option value="">Choose a role…</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {isBranch && (
                <p className={`text-xs ${hintText}`}>
                  Roles are set up by your director. Ask them if you need a new one.
                </p>
              )}
            </>
          )}
        </div>

        {branches && (
          <div className="space-y-1">
            <Label htmlFor="staffBranch">Branch</Label>
            <select
              id="staffBranch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className={`h-10 w-full rounded-lg border bg-white px-3 text-sm ${selectBorder}`}
            >
              <option value="">All branches (director level)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className={`text-xs ${hintText}`}>
              Leaving this on "All branches" gives them oversight of every location.
            </p>
          </div>
        )}

        {/* How they get access */}
        <div className={`space-y-3 rounded-md border p-4 ${panelBorder}`}>
          <Label>How should they get access?</Label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="radio"
              name="accessMethod"
              checked={!sendInvite}
              onChange={() => setSendInvite(false)}
              className="mt-1"
            />
            <span className="text-sm">
              <span className={isBranch ? "text-navy" : "text-ink"}>Set a password now</span>
              <span className={`mt-0.5 block text-xs ${hintText}`}>
                You'll give them the password directly. Best for staff without an email address.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="radio"
              name="accessMethod"
              checked={sendInvite}
              onChange={() => setSendInvite(true)}
              className="mt-1"
            />
            <span className="text-sm">
              <span className={isBranch ? "text-navy" : "text-ink"}>Email them an invitation</span>
              <span className={`mt-0.5 block text-xs ${hintText}`}>
                They'll set their own password from a link.
              </span>
            </span>
          </label>

          {!sendInvite && (
            <div className="space-y-1 pt-2">
              <Label htmlFor="staffPassword">Password</Label>
              <Input
                id="staffPassword"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`font-mono ${selectBorder}`}
              />
              <p
                className={`text-xs ${
                  passwordTooShort ? (isBranch ? "text-danger" : "text-ember") : hintText
                }`}
              >
                At least {MIN_PASSWORD_LENGTH} characters. Make a note of it — you'll need to pass
                it on.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving || roles.length === 0} className={primaryButton}>
            {saving
              ? sendInvite
                ? "Sending invitation…"
                : "Creating…"
              : sendInvite
                ? "Send invitation"
                : "Create staff member"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  );
}