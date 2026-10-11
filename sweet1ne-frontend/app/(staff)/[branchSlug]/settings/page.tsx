"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { SettingsSection } from "@/components/settings/settings-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminLoading } from "@/components/admin/admin-loading";

type BranchSettings = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  capacity: number | null;
  opening_time: string | null;
  closing_time: string | null;
  prep_minutes_min: number;
  prep_minutes_max: number;
  overdue_warning_minutes: number;
  overdue_alert_minutes: number;
  emergency_phone: string | null;
  fire_assembly_point: string | null;
  first_aider_name: string | null;
};

export default function BranchSettingsPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [branch, setBranch] = useState<BranchSettings | null>(null);
  const [draft, setDraft] = useState<Partial<BranchSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = hasPermission(me, "manage_settings");

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canEdit) {
      router.replace(`/${branchSlug}/dashboard`);
      return;
    }
    apiFetch("/settings/branches")
      .then((list: BranchSettings[]) => {
        setBranch(list.find((b) => b.slug === branchSlug) ?? list[0] ?? null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [meLoading, me, canEdit, branchSlug, router]);

  function value<K extends keyof BranchSettings>(key: K): BranchSettings[K] | undefined {
    return (draft[key] ?? branch?.[key]) as BranchSettings[K] | undefined;
  }

  function set<K extends keyof BranchSettings>(key: K, v: BranchSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  }

  async function save() {
    if (!branch) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/settings/branches/${branch.id}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      setBranch(updated);
      setDraft({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save those settings.");
    } finally {
      setSaving(false);
    }
  }

  if (meLoading || !me || !canEdit || loading) {
    return <AdminLoading />;
  }

  if (!branch) {
    return <p className="admin-empty">No branch found.</p>;
  }

  const dirty = Object.keys(draft).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sm:text-3xl">Settings</h1>
          <p className="admin-dek">{branch.name}</p>
        </div>

        {dirty && (
          <button type="button" onClick={save} disabled={saving} className="admin-book">
            {saving ? "Saving…" : "Save changes"}
          </button>
        )}

        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--gold)]">
            <Check size={16} />
            Saved
          </span>
        )}
      </div>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      {/* General */}
      <SettingsSection
        tone="admin"
        title="General"
        description="Where this branch is and when it's open."
      >
        <div className="space-y-1">
          <Label htmlFor="address" className="text-[var(--ivory)]">
            Address
          </Label>
          <Input
            id="address"
            value={value("address") ?? ""}
            onChange={(e) => set("address", e.target.value)}
            className="border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="phone" className="text-[var(--ivory)]">
              Phone
            </Label>
            <Input
              id="phone"
              value={value("phone") ?? ""}
              onChange={(e) => set("phone", e.target.value)}
              className="border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="capacity" className="text-[var(--ivory)]">
              Covers
            </Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              value={value("capacity") ?? ""}
              onChange={(e) => set("capacity", Number(e.target.value))}
              className="border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="opens" className="text-[var(--ivory)]">
              Opens
            </Label>
            <Input
              id="opens"
              type="time"
              value={value("opening_time") ?? ""}
              onChange={(e) => set("opening_time", e.target.value)}
              className="border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="closes" className="text-[var(--ivory)]">
              Closes
            </Label>
            <Input
              id="closes"
              type="time"
              value={value("closing_time") ?? ""}
              onChange={(e) => set("closing_time", e.target.value)}
              className="border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
            />
          </div>
        </div>
      </SettingsSection>

      {/* Service */}
      <SettingsSection
        tone="admin"
        title="Service times"
        description="Used for the customer's expected time and the kitchen's overdue warnings."
      >
        <div className="space-y-1">
          <Label className="text-[var(--ivory)]">Typical wait for an order</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              className="w-24 border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
              value={value("prep_minutes_min") ?? 15}
              onChange={(e) => set("prep_minutes_min", Number(e.target.value))}
            />
            <span className="text-sm text-[var(--ivory-dim)]">to</span>
            <Input
              type="number"
              min="1"
              className="w-24 border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
              value={value("prep_minutes_max") ?? 25}
              onChange={(e) => set("prep_minutes_max", Number(e.target.value))}
            />
            <span className="text-sm text-[var(--ivory-dim)]">minutes</span>
          </div>
          <p className="text-xs text-[var(--ivory-dim)]">
            Shown to customers as "expected around…" after they order.
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-[var(--ivory)]">Flag an order as running late after</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min="1"
              className="w-24 border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
              value={value("overdue_warning_minutes") ?? 10}
              onChange={(e) => set("overdue_warning_minutes", Number(e.target.value))}
            />
            <span className="text-sm text-[var(--ivory-dim)]">minutes (amber), and</span>
            <Input
              type="number"
              min="1"
              className="w-24 border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
              value={value("overdue_alert_minutes") ?? 20}
              onChange={(e) => set("overdue_alert_minutes", Number(e.target.value))}
            />
            <span className="text-sm text-[var(--ivory-dim)]">minutes (red)</span>
          </div>
          <p className="text-xs text-[var(--ivory-dim)]">
            Order cards on the kitchen and bar screens change colour at these points.
          </p>
        </div>
      </SettingsSection>

      {/* Safety */}
      <SettingsSection
        tone="admin"
        title="Safety &amp; emergency"
        description="Shown on staff screens at this branch."
      >
        <div className="space-y-1">
          <Label htmlFor="emergency" className="text-[var(--ivory)]">
            Emergency contact number
          </Label>
          <Input
            id="emergency"
            value={value("emergency_phone") ?? ""}
            onChange={(e) => set("emergency_phone", e.target.value)}
            placeholder="Duty manager or site number"
            className="border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="assembly" className="text-[var(--ivory)]">
            Fire assembly point
          </Label>
          <Input
            id="assembly"
            value={value("fire_assembly_point") ?? ""}
            onChange={(e) => set("fire_assembly_point", e.target.value)}
            placeholder="e.g. Car park, far end by the gate"
            className="border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="firstaider" className="text-[var(--ivory)]">
            First aider on site
          </Label>
          <Input
            id="firstaider"
            value={value("first_aider_name") ?? ""}
            onChange={(e) => set("first_aider_name", e.target.value)}
            className="border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
          />
        </div>
      </SettingsSection>
    </div>
  );
}