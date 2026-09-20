"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { useMediaLibrary, mediaThumb, type MediaItem } from "@/lib/use-media-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiField } from "@/components/ui/emoji-field";
import {
  addBlock,
  BLOCK_LABELS,
  CTA_PRESETS,
  defaultEventLayout,
  hasBlock,
  heroImageOf,
  moveBlock,
  removeBlock,
  setHeroImage,
  toLocalInput,
  updateBlock,
  type EventBlock,
  type EventBlockType,
  type EventCta,
  type EventCtaKind,
} from "./event-blocks";

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
  layout: EventBlock[];
  ctas: EventCta[];
};

type Option = { id: string; name: string };

export type AdminEventDraft = {
  title: string;
  tagline: string;
  description: string;
  startsAt: string;
  endsAt: string;
  layout: EventBlock[];
  ctas: EventCta[];
};

export const emptyAdminDraft = (event?: Event): AdminEventDraft => ({
  title: event?.title ?? "",
  tagline: event?.tagline ?? "",
  description: event?.description ?? "",
  startsAt: toLocalInput(event?.starts_at ?? null),
  endsAt: toLocalInput(event?.ends_at ?? null),
  layout: event?.layout?.length ? event.layout : defaultEventLayout(),
  ctas: event?.ctas?.length ? event.ctas : [{ kind: "book", ...CTA_PRESETS.book }],
});

type BranchProps = {
  tone: "branch";
  event?: Event;
  branches?: Option[];
  onSaved: (event: Event) => void;
  onCancel: () => void;
};

type AdminProps = {
  tone: "admin";
  event?: Event;
  branches?: Option[];
  draft: AdminEventDraft;
  onDraftChange: (patch: Partial<AdminEventDraft>) => void;
  onSaved: (event: Event) => void;
  onCancel: () => void;
};

export function EventForm(props: BranchProps | AdminProps) {
  if (props.tone === "branch") return <BranchEventForm {...props} />;
  return <AdminEventForm {...props} />;
}

/* ── Branch console — unchanged from before the admin redesign. ─────────── */

function BranchEventForm({ event, branches, onSaved, onCancel }: BranchProps) {
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
        ? await apiFetch(`/events/${event.id}`, { method: "PATCH", body: JSON.stringify(body) })
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
        {error && (
          <div role="alert" className="rounded-lg border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="e-image">Image</Label>
          {imageUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-slate-border">
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
              className="flex h-32 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-border text-sm text-slate-muted"
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
          <p className="text-xs text-slate-muted">
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
            className="border-slate-border"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="e-slug">Web address</Label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-slate-muted">/events/</span>
            <Input
              id="e-slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              className="font-mono border-slate-border"
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
            className="border-slate-border"
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
            className="w-full rounded-lg border border-slate-border bg-white px-3 py-2.5 text-sm"
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
              className="border-slate-border"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="e-end">Ends</Label>
            <Input
              id="e-end"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="border-slate-border"
            />
            <p className="text-xs text-slate-muted">Optional.</p>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="e-price">Entry</Label>
          <Input
            id="e-price"
            placeholder="e.g. £25 per person, Free entry, Booking required"
            value={priceNote}
            onChange={(e) => setPriceNote(e.target.value)}
            className="border-slate-border"
          />
        </div>

        {branches && !event && (
          <div className="space-y-1">
            <Label htmlFor="e-branch">Where</Label>
            <select
              id="e-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-border bg-white px-3 text-sm"
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

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-border p-4">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#10b981]"
          />
          <span className="text-sm">
            <span className="text-navy">Announce this on the website</span>
            <span className="mt-0.5 block text-xs text-slate-muted">
              Shows a popup to visitors. Only the soonest announced event appears, so several can
              be ticked without competing.
            </span>
          </span>
        </label>

        <div className="flex gap-3 pt-1">
          <Button
            type="submit"
            disabled={saving || uploading}
            className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
          >
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

/* ── Admin console — the full block composer. ────────────────────────── */

const ADDABLE: EventBlockType[] = ["logo", "kicker", "meta", "title", "dek", "image", "note", "ctas"];


/** A quick-add picture strip, right under the add-blocks bar — tapping a
   tile immediately adds a new picture block filled with that image,
   without going through "+ Picture" first. Padded out to a full 3×3 grid
   with empty placeholder tiles until the real /admin/media library has
   enough in it to fill the shape. */
function QuickGallery({
  media,
  layout,
  onChange,
}: {
  media: MediaItem[];
  layout: EventBlock[];
  onChange: (next: EventBlock[]) => void;
}) {
  const slots = Math.max(9, media.length);

  return (
    <div className="admin-media-grid is-quick">
      {Array.from({ length: slots }, (_, i) => {
        const item = media[i];
        if (!item) {
          return (
            <button key={`empty-${i}`} type="button" className="is-none" disabled>
              <span>No image</span>
            </button>
          );
        }
        const thumb = mediaThumb(item);
        return (
          <button
            key={item.id}
            type="button"
            className={item.kind === "video" ? "is-film" : undefined}
            onClick={() => onChange(addBlock(layout, "image", thumb))}
          >
            {thumb && <img src={thumb} alt="" />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function CtaEditor({ ctas, onChange }: { ctas: EventCta[]; onChange: (next: EventCta[]) => void }) {
  function update(i: number, patch: Partial<EventCta>) {
    onChange(ctas.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  return (
    <div className="admin-cta-stack">
      {ctas.map((cta, i) => (
        <div key={i} className="admin-cta-row">
          <label>
            Type
            <select
              value={cta.kind}
              onChange={(e) => {
                const kind = e.target.value as EventCtaKind;
                if (kind === "url") {
                  update(i, { kind, label: cta.label || "Open", href: "" });
                } else {
                  update(i, { kind, ...CTA_PRESETS[kind] });
                }
              }}
            >
              <option value="book">Book</option>
              <option value="menu">Menu</option>
              <option value="order">Order</option>
              <option value="url">URL</option>
            </select>
          </label>
          <label>
            Label
            <input value={cta.label} onChange={(e) => update(i, { label: e.target.value })} />
          </label>
          <label>
            URL
            <input
              type="url"
              placeholder="Custom URL"
              value={cta.kind === "url" ? cta.href : ""}
              disabled={cta.kind !== "url"}
              onChange={(e) => update(i, { href: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="admin-ghost"
            onClick={() => onChange(ctas.filter((_, idx) => idx !== i))}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function LayoutEditor({
  media,
  layout,
  onChange,
}: {
  media: MediaItem[];
  layout: EventBlock[];
  onChange: (next: EventBlock[]) => void;
}) {
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleDrop(targetIndex: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from === null || from === targetIndex) return;
    const next = layout.slice();
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
  }

  return (
    <div>
      {layout.map((block, i) => (
        <div
          key={block.id}
          className={`admin-layout-row${overIndex === i ? " is-drop-target" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragIndex.current !== null) setOverIndex(i);
          }}
          onDragLeave={() => setOverIndex((cur) => (cur === i ? null : cur))}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(i);
          }}
        >
          <div className="admin-block-head">
            <div className="admin-row-acts">
              <button
                type="button"
                className="admin-drag-handle"
                draggable
                onDragStart={(e) => {
                  dragIndex.current = i;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  dragIndex.current = null;
                  setOverIndex(null);
                }}
                aria-label={`Drag to reorder ${BLOCK_LABELS[block.type]}`}
              >
                ⠿
              </button>
              <p>{BLOCK_LABELS[block.type]}</p>
            </div>
            <div className="admin-row-acts">
              <button type="button" className="admin-edit" onClick={() => onChange(moveBlock(layout, i, -1))} disabled={i === 0}>
                ↑
              </button>
              <button
                type="button"
                className="admin-edit"
                onClick={() => onChange(moveBlock(layout, i, 1))}
                disabled={i === layout.length - 1}
              >
                ↓
              </button>
              <button type="button" className="admin-edit" onClick={() => onChange(removeBlock(layout, block.id))}>
                Remove
              </button>
            </div>
          </div>

          {block.type === "logo" && (
            <select
              value={block.size}
              onChange={(e) => onChange(updateBlock(layout, block.id, { size: e.target.value } as Partial<EventBlock>))}
            >
              <option value="s">Small</option>
              <option value="m">Medium</option>
              <option value="l">Large</option>
            </select>
          )}

          {block.type === "image" && (
            <>
              <div className="admin-media-grid">
                {media.length === 0 && (
                  <button type="button" className="is-none" disabled>
                    <span>No media yet</span>
                  </button>
                )}
                {media.map((item) => {
                  const thumb = mediaThumb(item);
                  const selected = block.image_url === thumb;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`${item.kind === "video" ? "is-film " : ""}${selected ? "is-on" : ""}`.trim()}
                      aria-pressed={selected}
                      onClick={() =>
                        onChange(updateBlock(layout, block.id, { image_url: selected ? "" : thumb } as Partial<EventBlock>))
                      }
                    >
                      {thumb && <img src={thumb} alt="" />}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={block.hero}
                  onChange={() => onChange(setHeroImage(layout, block.id))}
                />
                Use as the hero picture
              </label>
            </>
          )}

          {block.type === "note" && (
            <EmojiField
              value={block.text}
              placeholder="Limited seats tonight"
              onChange={(text) => onChange(updateBlock(layout, block.id, { text } as Partial<EventBlock>))}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function AdminEventForm({ event, branches, draft, onDraftChange, onSaved, onCancel }: AdminProps) {
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(event));
  const [priceNote, setPriceNote] = useState(event?.price_note ?? "");
  const [branchId, setBranchId] = useState(event?.branch_id ?? "");
  const [isFeatured, setIsFeatured] = useState(event?.is_featured ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { media } = useMediaLibrary();

  const { title, tagline, description, startsAt, endsAt, layout, ctas } = draft;

  function changeTitle(value: string) {
    onDraftChange({ title: value });
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!startsAt) {
      setError("Please set when the night starts.");
      return;
    }

    setSaving(true);
    try {
      const hero = heroImageOf(layout);
      const body = {
        title,
        slug: slug || slugify(title),
        tagline: tagline || null,
        description: description || null,
        image_url: hero?.image_url || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        price_note: priceNote || null,
        is_featured: isFeatured,
        layout,
        ctas,
        ...(branches && !event ? { branch_id: branchId || null } : {}),
      };

      const saved = event
        ? await apiFetch(`/events/${event.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/events", { method: "POST", body: JSON.stringify(body) });

      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this night.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      <fieldset disabled={saving} className="contents">
        {error && (
          <p role="alert" className="admin-hold mb-3 text-sm">
            {error}
          </p>
        )}

        <div className="admin-block-head">
          <p>Bits</p>
        </div>
        <div className="admin-bit-bar mb-3">
          {ADDABLE.map((type) => (
            <button key={type} type="button" onClick={() => onDraftChange({ layout: addBlock(layout, type) })}>
              + {BLOCK_LABELS[type]}
            </button>
          ))}
        </div>

        <div className="admin-block-head">
          <p>Pictures</p>
        </div>
        <QuickGallery media={media} layout={layout} onChange={(next) => onDraftChange({ layout: next })} />

        <LayoutEditor media={media} layout={layout} onChange={(next) => onDraftChange({ layout: next })} />

        <label>
          Date
          <input type="datetime-local" required value={startsAt} onChange={(e) => onDraftChange({ startsAt: e.target.value })} />
        </label>
        <label>
          Ends
          <input type="datetime-local" value={endsAt} onChange={(e) => onDraftChange({ endsAt: e.target.value })} />
        </label>

        {branches && !event && (
          <label>
            Restaurant
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Both</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Kicker
          <EmojiField value={tagline} onChange={(v) => onDraftChange({ tagline: v })} />
        </label>

        <label>
          Title
          <EmojiField required value={title} onChange={changeTitle} />
        </label>

        <label>
          Web address
          <input
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </label>

        <label>
          Copy
          <EmojiField multiline value={description} onChange={(v) => onDraftChange({ description: v })} />
        </label>

        <label>
          Entry
          <input
            placeholder="e.g. £25 per person, Free entry, Booking required"
            value={priceNote}
            onChange={(e) => setPriceNote(e.target.value)}
          />
        </label>

        {hasBlock(layout, "ctas") && (
          <div className="admin-block-head">
            <p>Buttons</p>
            <button
              type="button"
              className="admin-add-bit"
              onClick={() => onDraftChange({ ctas: [...ctas, { kind: "book", ...CTA_PRESETS.book }] })}
            >
              Add button
            </button>
          </div>
        )}
        {hasBlock(layout, "ctas") && (
          <CtaEditor ctas={ctas} onChange={(next) => onDraftChange({ ctas: next })} />
        )}

        <label>
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
          Announce this on the website
        </label>

        <div className="flex gap-3 pt-1">
          <button type="submit" className="admin-book" disabled={saving}>
            {saving ? "Saving…" : event ? "Save changes" : "Add night"}
          </button>
          <button type="button" className="admin-book" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
