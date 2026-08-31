"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export type Event = {
  id: string;
  branch_id: string | null;
  branch_name: string | null;
  title: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  price_note: string | null;
  is_featured: boolean;
  is_published: boolean;
};

type Option = { id: string; name: string };

/** datetime-local wants "YYYY-MM-DDTHH:mm", not a full ISO string. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function EventForm({
  event,
  branches,
  tone,
  onSaved,
  onCancel,
}: {
  event?: Event;
  /** Omitted at branch level — a manager's own branch is used. */
  branches?: Option[];
  tone: "admin" | "branch";
  onSaved: (event: Event) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(event));
  const [tagline, setTagline] = useState(event?.tagline ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [imageUrl, setImageUrl] = useState(event?.image_url ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(event?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(event?.ends_at ?? null));
  const [priceNote, setPriceNote] = useState(event?.price_note ?? "");
  const [branchId, setBranchId] = useState(event?.branch_id ?? "");
  const [isFeatured, setIsFeatured] = useState(event?.is_featured ?? true);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBranch = tone === "branch";
  const primary = isBranch
    ? "bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
    : "bg-gold text-ink hover:bg-gold/90";
  const border = isBranch ? "border-slate-border" : "border-ink/15";
  const muted = isBranch ? "text-slate-muted" : "text-ink-muted";
  const errorBox = isBranch
    ? "border border-danger/25 bg-danger-bg text-danger"
    : "border border-ember/25 bg-ember-soft text-ember";

  // The slug follows the title until someone edits it themselves.
  function changeTitle(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
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

      const res = await fetch(`${API_URL}/uploads/images?folder=events`, {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed.");

      const { url } = await res.json();
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!startsAt) {
      setError("Please set when the event starts.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        title,
        slug: slug || slugify(title),
        tagline: tagline || null,
        description: description || null,
        image_url: imageUrl || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        price_note: priceNote || null,
        is_featured: isFeatured,
        ...(branches && !event ? { branch_id: branchId || null } : {}),
      };

      const saved = event
        ? await apiFetch(`/events/${event.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : await apiFetch("/events", { method: "POST", body: JSON.stringify(body) });

      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={saving} className="space-y-5">
        {error && <div role="alert" className={`rounded-lg px-4 py-3 text-sm ${errorBox}`}>{error}</div>}

        {/* Image */}
        <div className="space-y-2">
          <Label htmlFor="e-image">Image</Label>
          {imageUrl ? (
            <div className={`relative overflow-hidden rounded-xl border ${border}`}>
              <img src={imageUrl} alt="" className="h-40 w-full object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl("")}
                className="absolute right-2 top-2 rounded-md bg-black/60 px-2.5 py-1 text-xs text-white"
              >
                Remove
              </button>
            </div>
          ) : (
            <label
              htmlFor="e-image"
              className={`flex h-32 cursor-pointer items-center justify-center rounded-xl border border-dashed text-sm ${border} ${muted}`}
            >
              {uploading ? "Uploading…" : "Click to upload an image"}
            </label>
          )}
          <input
            id="e-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={uploadImage}
            className="hidden"
          />
          <p className={`text-xs ${muted}`}>
            Appears on the website and in the popup. Landscape works best.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="e-title">Title</Label>
          <Input
            id="e-title"
            required
            placeholder="e.g. Sax & Mood Brunch"
            value={title}
            onChange={(e) => changeTitle(e.target.value)}
            className={border}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="e-slug">Web address</Label>
          <div className="flex items-center gap-2">
            <span className={`shrink-0 text-sm ${muted}`}>/events/</span>
            <Input
              id="e-slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              className={`font-mono ${border}`}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="e-tagline">Tagline</Label>
          <Input
            id="e-tagline"
            placeholder="One line — shown under the title"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className={border}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="e-description">Description</Label>
          <textarea
            id="e-description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="The full details. Leave a blank line between paragraphs."
            className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm ${border}`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="e-start">Starts</Label>
            <Input
              id="e-start"
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={border}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="e-end">Ends</Label>
            <Input
              id="e-end"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={border}
            />
            <p className={`text-xs ${muted}`}>Optional.</p>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="e-price">Entry</Label>
          <Input
            id="e-price"
            placeholder="e.g. £25 per person, Free entry, Booking required"
            value={priceNote}
            onChange={(e) => setPriceNote(e.target.value)}
            className={border}
          />
        </div>

        {branches && !event && (
          <div className="space-y-1">
            <Label htmlFor="e-branch">Where</Label>
            <select
              id="e-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className={`h-10 w-full rounded-lg border bg-white px-3 text-sm ${border}`}
            >
              <option value="">Both branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${border}`}>
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className={`mt-0.5 h-4 w-4 ${isBranch ? "accent-[#10b981]" : "accent-[#d4a853]"}`}
          />
          <span className="text-sm">
            <span className={isBranch ? "text-navy" : "text-ink"}>
              Announce this on the website
            </span>
            <span className={`mt-0.5 block text-xs ${muted}`}>
              Shows a popup to visitors. Only the soonest announced event appears,
              so several can be ticked without competing.
            </span>
          </span>
        </label>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={saving || uploading} className={primary}>
            {saving ? "Saving…" : event ? "Save changes" : "Create event"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  );
}