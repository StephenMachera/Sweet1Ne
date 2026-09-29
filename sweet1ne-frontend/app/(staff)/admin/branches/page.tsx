"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { AdminLoading } from "@/components/admin/admin-loading";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DARK_DIALOG =
  "border border-[rgba(201,162,74,0.42)] bg-[#0c0c0c] text-[#e5e2e1] sm:max-w-sm";
const DIALOG_BOOK_BTN =
  "inline-block rounded-[3px] border border-[rgba(201,162,74,0.9)] bg-transparent px-[1.15rem] py-[0.7rem] text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#c9a24a] hover:bg-[#c9a24a] hover:text-[#0e0e0e]";
const DIALOG_GHOST_BTN =
  "inline-block rounded-[3px] border border-[rgba(229,226,225,0.25)] bg-transparent px-[1.15rem] py-[0.7rem] text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#e5e2e1] hover:bg-[rgba(229,226,225,0.08)]";

type Place = "both" | "lewisham" | "chingford";

// Lewisham and Chingford are real, currently-open restaurants seeded for
// every tenant — not sample rows a staff member should be able to rename
// away from or remove. Any other branch they add is fully theirs.
const LOCKED_SLUGS = new Set(["lewisham", "chingford"]);

type Branch = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  settings: { kicker?: string; hours?: string; toast?: string };
  is_active: boolean;
};

/** "020 3340 6750" -> "+442033406750" — a UK national number to a
   dialable international one, since the two only ever differ by that
   leading 0 vs the country code. */
function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "");
  return `tel:+44${digits}`;
}

/** A URL-safe slug from a name, made unique against the branches already
   loaded — mirrors how a second "Chingford" wouldn't silently collide with
   the first one's guest URL. */
function slugFor(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "branch";
  let slug = base;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

type Draft = {
  id: string | null;
  name: string;
  kicker: string;
  phone: string;
  address: string;
  hours: string;
  toast: string;
};

function emptyDraft(): Draft {
  return {
    id: null,
    name: "",
    kicker: "",
    phone: "",
    address: "",
    hours: "",
    toast: "",
  };
}

export default function AdminBranchesPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const canManage = hasPermission(me, "manage_tenant");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [place, setPlace] = useState<Place>("both");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null | "new">(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Branch | null>(null);
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
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) router.replace("/admin/dashboard");
  }, [meLoading, me, canManage, router]);

  function openEdit(branch: Branch) {
    setEditingId(branch.id);
    setDraft({
      id: branch.id,
      name: branch.name,
      kicker: branch.settings.kicker ?? "",
      phone: branch.phone ?? "",
      address: branch.address ?? "",
      hours: branch.settings.hours ?? "",
      toast: branch.settings.toast ?? "",
    });
  }

  function openAdd() {
    setEditingId("new");
    setDraft(emptyDraft());
  }

  function closeEdit() {
    setEditingId(null);
  }

  const editingBranch = branches.find((b) => b.id === editingId) ?? null;
  const locked = editingBranch ? LOCKED_SLUGS.has(editingBranch.slug) : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    const address = draft.address.trim();
    if (!name || !phone || !address) return;

    setSaving(true);
    setError(null);
    try {
      const settings = {
        kicker: draft.kicker.trim(),
        hours: draft.hours.trim(),
        toast: draft.toast.trim(),
      };
      if (editingId && editingId !== "new") {
        const updated = await apiFetch(`/branches/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ name, phone, address, settings }),
        });
        setBranches((prev) =>
          prev.map((b) => (b.id === updated.id ? updated : b)),
        );
      } else {
        const taken = new Set(branches.map((b) => b.slug));
        const created = await apiFetch("/branches", {
          method: "POST",
          body: JSON.stringify({
            name,
            phone,
            address,
            slug: slugFor(name, taken),
            settings,
          }),
        });
        setBranches((prev) => [...prev, created]);
      }
      closeEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setError(null);
    try {
      await apiFetch(`/branches/${removing.id}`, { method: "DELETE" });
      setBranches((prev) => prev.filter((b) => b.id !== removing.id));
      setRemoving(null);
      if (editingId === removing.id) closeEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that.");
      setRemoving(null);
    }
  }

  if (meLoading || !me || !canManage) {
    return <AdminLoading />;
  }

  const visible = branches.filter(
    (b) => b.is_active && (place === "both" || b.slug.includes(place)),
  );

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
              {p === "both"
                ? "Both"
                : p === "lewisham"
                  ? "Lewisham"
                  : "Chingford"}
            </button>
          ))}
        </div>
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Branches</h1>
      <p className="admin-dek">
        Hours, phones, collection. Add a restaurant when there is a real door.
      </p>

      <div className="admin-tools">
        <button type="button" className="admin-book" onClick={openAdd}>
          Add branch
        </button>
      </div>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      {loading ? (
        <AdminLoading />
      ) : (
        <section className="admin-board" aria-label="Restaurants">
          {visible.map((branch) => (
            <article key={branch.id} className="admin-card">
              <h2>{branch.name}</h2>
              <p className="admin-stat">{branch.phone || "—"}</p>
              <p>{branch.address || "—"}</p>
              <p className="admin-muted">
                {branch.settings.hours
                  ? branch.settings.hours.replace(/\n/g, " · ")
                  : "Hours not set yet."}
              </p>
              <div className="admin-acts">
                {branch.settings.toast && (
                  <a
                    className="admin-book"
                    href={branch.settings.toast}
                    target="_blank"
                    rel="noopener"
                  >
                    Toast
                  </a>
                )}
                {branch.phone && (
                  <a className="admin-book" href={telHref(branch.phone)}>
                    Call
                  </a>
                )}
                <button
                  type="button"
                  className="admin-book"
                  onClick={() => openEdit(branch)}
                >
                  Edit
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Editor — portaled into the third grid column owned by the shared
          /admin layout. See #admin-drawer-slot in admin/layout.tsx. */}
      {editingId &&
        drawerSlot &&
        createPortal(
          <aside className="admin-drawer-edit is-wide">
            <h2>
              {draft.name ||
                (editingId === "new" ? "Add branch" : editingBranch?.name)}
            </h2>
            <form onSubmit={handleSubmit} className="admin-form">
              <label>
                Name
                <input
                  required
                  readOnly={locked}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Kicker
                <input
                  placeholder="East London"
                  value={draft.kicker}
                  onChange={(e) =>
                    setDraft({ ...draft, kicker: e.target.value })
                  }
                />
              </label>
              <label>
                Phone
                <input
                  required
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value })
                  }
                />
              </label>
              <label>
                Address
                <input
                  required
                  value={draft.address}
                  onChange={(e) =>
                    setDraft({ ...draft, address: e.target.value })
                  }
                />
              </label>
              <label>
                Hours
                <textarea
                  value={draft.hours}
                  onChange={(e) =>
                    setDraft({ ...draft, hours: e.target.value })
                  }
                />
              </label>
              <label>
                Collection link
                <input
                  type="url"
                  placeholder="https://order.toasttab.com/online/…"
                  value={draft.toast}
                  onChange={(e) =>
                    setDraft({ ...draft, toast: e.target.value })
                  }
                />
              </label>
              <p className="admin-row-acts">
                <button type="submit" className="admin-book" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="admin-book"
                  onClick={closeEdit}
                >
                  Close
                </button>
                {editingId !== "new" && !locked && editingBranch && (
                  <button
                    type="button"
                    className="admin-edit"
                    onClick={() => setRemoving(editingBranch)}
                  >
                    Remove
                  </button>
                )}
              </p>
            </form>
          </aside>,
          drawerSlot,
        )}

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <DialogContent className={DARK_DIALOG}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#e5e2e1]">
              Remove this branch?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#a8a4a2]">
            {removing?.name} stops showing everywhere staff pick a restaurant.
            Its past orders and history stay on record.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className={DIALOG_GHOST_BTN}
              onClick={() => setRemoving(null)}
            >
              Keep it
            </button>
            <button
              type="button"
              className={DIALOG_BOOK_BTN}
              onClick={confirmRemove}
            >
              Remove
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
