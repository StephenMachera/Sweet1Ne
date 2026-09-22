"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useMe, hasPermission } from "@/lib/use-me";
import { SettingsSection, Toggle } from "@/components/settings/settings-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminLoading } from "@/components/admin/admin-loading";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type TenantSettings = {
  name: string;
  logo_url: string | null;
  currency: string;
  timezone: string;
  email: string | null;
  ask_for_customer_name: boolean;
  show_staff_names_to_customers: boolean;
  order_retention_days: number;
  allergen_notice: string | null;
  food_hygiene_rating: number | null;
};

const CURRENCIES = ["GBP", "EUR", "USD"];
const TIMEZONES = ["Europe/London", "Europe/Dublin", "UTC"];

type Branch = { id: string; name: string; phone: string | null; settings?: { toast?: string } };
type TableCounts = { total: number; attached: number };

export default function AdminSettingsPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [tab, setTab] = useState<"general" | "connections">("general");
  const [data, setData] = useState<TenantSettings | null>(null);
  const [draft, setDraft] = useState<Partial<TenantSettings>>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tableCounts, setTableCounts] = useState<TableCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = hasPermission(me, "manage_tenant");

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canEdit) {
      router.replace("/admin/dashboard");
      return;
    }
    apiFetch("/settings/tenant")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    apiFetch("/branches").then(setBranches).catch(() => setBranches([]));
    apiFetch("/tables")
      .then((items: { qr_code_url: string | null }[]) =>
        setTableCounts({ total: items.length, attached: items.filter((t) => t.qr_code_url).length })
      )
      .catch(() => setTableCounts(null));
  }, [meLoading, me, canEdit, router]);

  function value<K extends keyof TenantSettings>(key: K): TenantSettings[K] | undefined {
    return (draft[key] ?? data?.[key]) as TenantSettings[K] | undefined;
  }

  function set<K extends keyof TenantSettings>(key: K, v: TenantSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await createClient().auth.getSession();

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/uploads/images?folder=branding`, {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed.");
      const { url } = await res.json();
      set("logo_url", url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch("/settings/tenant", {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      setData(updated);
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

  const dirty = Object.keys(draft).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-[var(--ivory)] max-md:hidden">Settings</h1>
          <p className="mt-1 text-sm text-[var(--ivory-dim)]">Company-wide configuration</p>
        </div>

        {tab === "general" && dirty && (
          <button type="button" onClick={save} disabled={saving} className="admin-book">
            {saving ? "Saving…" : "Save changes"}
          </button>
        )}

        {tab === "general" && saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--gold)]">
            <Check size={16} />
            Saved
          </span>
        )}
      </div>

      <div className="admin-cats" role="group" aria-label="Section">
        <button
          type="button"
          className={tab === "general" ? "is-on" : undefined}
          onClick={() => setTab("general")}
        >
          General
        </button>
        <button
          type="button"
          className={tab === "connections" ? "is-on" : undefined}
          onClick={() => setTab("connections")}
        >
          Connections
        </button>
      </div>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      {tab === "connections" ? (
        <ConnectionsBoard branches={branches} tableCounts={tableCounts} email={data?.email ?? null} />
      ) : (
        <>
      {/* General */}
      <SettingsSection
        tone="admin"
        title="General"
        description="How the company appears to staff and customers."
      >
        <div className="space-y-2">
          <Label className="text-[var(--ivory)]">Logo</Label>
          <div className="flex items-center gap-4">
            {value("logo_url") ? (
              <img
                src={value("logo_url")!}
                alt=""
                className="h-16 w-16 rounded-full object-cover ring-2 ring-[var(--panel-2)]"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gold)] text-xl font-semibold text-[#0e0e0e]">
                {(value("name") ?? "S").charAt(0)}
              </span>
            )}
            <label
              htmlFor="logo"
              className="cursor-pointer rounded-[3px] border border-[var(--gold-line)] bg-[#050505] px-4 py-2 text-sm text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
            >
              {uploading ? "Uploading…" : "Change logo"}
            </label>
            <input
              id="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadLogo}
              className="hidden"
            />
          </div>
          <p className="text-xs text-[var(--ivory-dim)]">
            Shown on the customer menu when they scan a code.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="name" className="text-[var(--ivory)]">
            Company name
          </Label>
          <Input
            id="name"
            value={value("name") ?? ""}
            onChange={(e) => set("name", e.target.value)}
            className="border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="currency" className="text-[var(--ivory)]">
              Currency
            </Label>
            <select
              id="currency"
              value={value("currency") ?? "GBP"}
              onChange={(e) => set("currency", e.target.value)}
              className="h-10 w-full rounded-[3px] border border-[var(--gold-line)] bg-[#050505] px-3 text-sm text-[var(--ivory)]"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="timezone" className="text-[var(--ivory)]">
              Timezone
            </Label>
            <select
              id="timezone"
              value={value("timezone") ?? "Europe/London"}
              onChange={(e) => set("timezone", e.target.value)}
              className="h-10 w-full rounded-[3px] border border-[var(--gold-line)] bg-[#050505] px-3 text-sm text-[var(--ivory)]"
            >
              {TIMEZONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SettingsSection>

      {/* Privacy */}
      <SettingsSection
        tone="admin"
        title="Privacy"
        description="What you collect from customers, and how long you keep it."
      >
        <Toggle
          tone="admin"
          label="Ask customers for a name"
          hint="Adds an optional name field when they place an order."
          checked={value("ask_for_customer_name") ?? false}
          onChange={(v) => set("ask_for_customer_name", v)}
        />

        <Toggle
          tone="admin"
          label="Show staff names to customers"
          hint="Whoever placed or is preparing an order appears on the customer's tracker."
          checked={value("show_staff_names_to_customers") ?? true}
          onChange={(v) => set("show_staff_names_to_customers", v)}
        />

        <div className="space-y-1">
          <Label htmlFor="retention" className="text-[var(--ivory)]">
            Keep order history for
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="retention"
              type="number"
              min="30"
              className="w-32 border-[var(--gold-line)] bg-[#050505] text-[var(--ivory)]"
              value={value("order_retention_days") ?? 365}
              onChange={(e) => set("order_retention_days", Number(e.target.value))}
            />
            <span className="text-sm text-[var(--ivory-dim)]">days</span>
          </div>
          <p className="text-xs text-[var(--ivory-dim)]">
            Recorded as your stated policy. Automatic deletion isn't running yet, so older orders
            are still kept.
          </p>
        </div>
      </SettingsSection>

      {/* Safety */}
      <SettingsSection
        tone="admin"
        title="Safety &amp; compliance"
        description="Shown to customers on the menu."
      >
        <div className="space-y-1">
          <Label htmlFor="allergen" className="text-[var(--ivory)]">
            Allergen notice
          </Label>
          <textarea
            id="allergen"
            rows={3}
            value={value("allergen_notice") ?? ""}
            onChange={(e) => set("allergen_notice", e.target.value)}
            placeholder="e.g. Please tell a member of staff about any allergies before ordering. Our dishes are prepared in a kitchen that handles nuts, gluten and dairy."
            className="w-full resize-none rounded-[3px] border border-[var(--gold-line)] bg-[#050505] px-3 py-2.5 text-sm text-[var(--ivory)]"
          />
          <p className="text-xs text-[var(--ivory-dim)]">
            Appears on every customer menu. Worth checking this against your current allergen
            policy.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="hygiene" className="text-[var(--ivory)]">
            Food hygiene rating
          </Label>
          <select
            id="hygiene"
            value={value("food_hygiene_rating") ?? ""}
            onChange={(e) =>
              set("food_hygiene_rating", e.target.value ? Number(e.target.value) : (null as any))
            }
            className="h-10 w-full rounded-[3px] border border-[var(--gold-line)] bg-[#050505] px-3 text-sm text-[var(--ivory)] sm:w-48"
          >
            <option value="">Not shown</option>
            {[5, 4, 3, 2, 1, 0].map((r) => (
              <option key={r} value={r}>
                {r} — {["Urgent improvement", "Major improvement", "Improvement", "Generally satisfactory", "Good", "Very good"][r]}
              </option>
            ))}
          </select>
        </div>
      </SettingsSection>
        </>
      )}
    </div>
  );
}

function ConnectionsBoard({
  branches,
  tableCounts,
  email,
}: {
  branches: Branch[];
  tableCounts: TableCounts | null;
  email: string | null;
}) {
  const toastLinks = branches.filter((b) => b.settings?.toast);

  return (
    <section className="admin-board" aria-label="Wiring">
      <article className="admin-card">
        <h2>Mail</h2>
        <p className="admin-stat">{email ?? "—"}</p>
        <p>Contact enquiries and the staff sign-in email.</p>
        {email && (
          <div className="admin-acts">
            <a className="admin-act" href={`mailto:${email}`}>
              Open mail
            </a>
          </div>
        )}
      </article>

      <article className="admin-card">
        <h2>Book</h2>
        <p className="admin-stat">SevenRooms</p>
        <p>Header Book on the website.</p>
      </article>

      <article className="admin-card">
        <h2>Collection</h2>
        <p className="admin-stat">Live</p>
        <p>Guests order collection on Toast. Tickets list here when connected.</p>
        <div className="admin-acts">
          <a className="admin-act" href="/admin/orders">
            Orders
          </a>
          {toastLinks.map((b) => (
            <a key={b.id} className="admin-act" href={b.settings!.toast} target="_blank" rel="noreferrer">
              {b.name} Toast
            </a>
          ))}
        </div>
      </article>

      <article className="admin-card is-wait">
        <h2>Table codes</h2>
        <p className="admin-stat admin-hold">
          {tableCounts ? `${tableCounts.attached} / ${tableCounts.total}` : "—"}
        </p>
        <p>Ask a waiter, or scan the table&rsquo;s own QR code.</p>
        <div className="admin-acts">
          <a className="admin-act" href="/admin/tables">
            Tables
          </a>
        </div>
      </article>

      <article className="admin-card is-wait">
        <h2>Toast</h2>
        <p className="admin-stat admin-hold">—</p>
        <p>Tickets not listing yet. Kitchen, Bar and Orders wait.</p>
      </article>

      <article className="admin-card is-wait">
        <h2>Bookings</h2>
        <p className="admin-stat admin-hold">—</p>
        <p>Not listing here yet. Guests still book on the website.</p>
        <div className="admin-acts">
          <a className="admin-act" href="/admin/reservations">
            Reservations
          </a>
        </div>
      </article>

      <article className="admin-card">
        <h2>Restaurants</h2>
        <p>
          {branches.length} branch{branches.length === 1 ? "" : "es"}. Public Find Us and Contact.
        </p>
        <div className="admin-acts">
          <a className="admin-act" href="/admin/branches">
            Branches
          </a>
        </div>
      </article>

      <article className="admin-card">
        <h2>Sign in</h2>
        <p>Staff accounts and roles.</p>
        <div className="admin-acts">
          <a className="admin-act" href="/admin/staff">
            Staff
          </a>
          <a className="admin-act" href="/admin/roles">
            Roles
          </a>
        </div>
      </article>

      <article className="admin-card">
        <h2>Media</h2>
        <p>Photos for mail, nights and the menu.</p>
        <div className="admin-acts">
          <a className="admin-act" href="/admin/media">
            Media
          </a>
        </div>
      </article>
    </section>
  );
}