"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";

type Place = "both" | "lewisham" | "chingford";

type Branch = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  settings: { hours?: string; toast?: string };
  is_active: boolean;
};

/** "020 3340 6750" -> "+442033406750" — a UK national number to a
   dialable international one, since the two only ever differ by that
   leading 0 vs the country code. */
function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "");
  return `tel:+44${digits}`;
}

export default function AdminBranchesPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const canManage = hasPermission(me, "manage_tenant");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [place, setPlace] = useState<Place>("both");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Branch | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [hours, setHours] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

  const load = useCallback(
    () =>
      apiFetch("/branches")
        .then(setBranches)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) router.replace("/admin/dashboard");
  }, [meLoading, me, canManage, router]);

  function openEdit(branch: Branch) {
    setEditing(branch);
    setName(branch.name);
    setPhone(branch.phone ?? "");
    setAddress(branch.address ?? "");
    setHours(branch.settings.hours ?? "");
    setToast(branch.settings.toast ?? "");
  }

  function closeEdit() {
    setEditing(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;

    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/branches/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, phone, address, settings: { hours, toast } }),
      });
      setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      closeEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  if (meLoading || !me || !canManage) {
    return <p className="text-sm text-[var(--ivory-dim)]">Loading…</p>;
  }

  const visible = branches.filter((b) => place === "both" || b.slug.includes(place));

  return (
    <>
      <div className="admin-top">
        <div className="admin-places" role="group" aria-label="Restaurant">
          {(["both", "lewisham", "chingford"] as Place[]).map((p) => (
            <button
              key={p}
              type="button"
              className={place === p ? "is-on" : undefined}
              onClick={() => setPlace(p)}
            >
              {p === "both" ? "Both" : p === "lewisham" ? "Lewisham" : "Chingford"}
            </button>
          ))}
        </div>
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Branches</h1>
      <p className="admin-dek">Lewisham · Chingford. Hours, phones, collection.</p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--ivory-dim)]">Loading…</p>
      ) : (
        <section className="admin-board" aria-label="Restaurants">
          {visible.map((branch) => (
            <article key={branch.id} className="admin-card">
              <h2>{branch.name}</h2>
              <p className="admin-stat">{branch.phone || "—"}</p>
              <p>{branch.address || "—"}</p>
              <p className="admin-muted">
                {branch.settings.hours ? branch.settings.hours.replace(/\n/g, " · ") : "Hours not set yet."}
              </p>
              <div className="admin-acts">
                {branch.settings.toast && (
                  <a className="admin-book" href={branch.settings.toast} target="_blank" rel="noopener">
                    Toast
                  </a>
                )}
                {branch.phone && (
                  <a className="admin-book" href={telHref(branch.phone)}>
                    Call
                  </a>
                )}
                <button type="button" className="admin-book" onClick={() => openEdit(branch)}>
                  Edit
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Editor — portaled into the third grid column owned by the shared
          /admin layout. See #admin-drawer-slot in admin/layout.tsx. */}
      {editing &&
        drawerSlot &&
        createPortal(
          <aside className="admin-drawer-edit is-wide">
            <h2>{name || editing.name}</h2>
            <form onSubmit={handleSubmit} className="admin-form">
              <label>
                Name
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Phone
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label>
                Address
                <input required value={address} onChange={(e) => setAddress(e.target.value)} />
              </label>
              <label>
                Hours
                <textarea value={hours} onChange={(e) => setHours(e.target.value)} />
              </label>
              <label>
                Toast link
                <input
                  type="url"
                  placeholder="https://order.toasttab.com/…"
                  value={toast}
                  onChange={(e) => setToast(e.target.value)}
                />
              </label>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="admin-book" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button type="button" className="admin-book" onClick={closeEdit}>
                  Close
                </button>
              </div>
            </form>
          </aside>,
          drawerSlot
        )}
    </>
  );
}
