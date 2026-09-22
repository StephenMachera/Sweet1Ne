"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useMediaLibrary, mediaThumb } from "@/lib/use-media-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MainCategory, SubCategory, MenuItem } from "./menu-browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

const MEDIA_PAGE_SIZE = 9; // 3x3 — same grid shape as the event composer's gallery
const MAX_PICTURES = 5; // the guest phone's carousel caps here

const DIETARY = ["vegetarian", "vegan", "gluten_free", "dairy_free", "halal", "low_calorie"];
const ALLERGENS = ["nuts", "peanuts", "dairy", "eggs", "gluten", "shellfish", "soy", "sesame"];

function TagPicker({
  tone,
  options,
  selected,
  onToggle,
  variant,
}: {
  tone: "admin" | "branch";
  options: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  variant?: "success" | "warning";
}) {
  if (tone === "branch") {
    const styles =
      variant === "success"
        ? { on: "bg-success-bg text-success", off: "border border-slate-border text-slate-muted" }
        : { on: "bg-warning-bg text-warning", off: "border border-slate-border text-slate-muted" };
    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={`rounded-full px-2.5 py-1 text-xs capitalize transition-colors ${
              selected.includes(tag) ? styles.on : styles.off
            }`}
          >
            {tag.replace(/_/g, " ")}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="admin-bit-bar">
      {options.map((tag) => (
        <button
          key={tag}
          type="button"
          className={selected.includes(tag) ? "is-on" : undefined}
          onClick={() => onToggle(tag)}
        >
          {tag.replace(/_/g, " ")}
        </button>
      ))}
    </div>
  );
}

export type MenuItemDraft = {
  title: string;
  description: string;
  price: string;
  picture: string | null;
  /** Up to 5, from the media library. The guest phone opens these as a
   *  carousel; `picture` (above) always mirrors pictures[0]. */
  pictures: string[];
};

export const emptyDraft = (item?: MenuItem): MenuItemDraft => ({
  title: item?.title ?? "",
  description: item?.description ?? "",
  price: item ? String(item.price) : "",
  picture: item?.picture ?? null,
  pictures: item?.pictures?.length ? item.pictures : item?.picture ? [item.picture] : [],
});

export function MenuItemForm({
  tone,
  item,
  mains,
  subs,
  draft: controlledDraft,
  onDraftChange: controlledOnDraftChange,
  onSaved,
  onCancel,
}: {
  tone: "admin" | "branch";
  item?: MenuItem;
  mains: MainCategory[];
  subs: SubCategory[];
  // Admin-only: pass both to lift the draft up for the live preview next to
  // the drawer. Branch tone always manages its own state.
  draft?: MenuItemDraft;
  onDraftChange?: (patch: Partial<MenuItemDraft>) => void;
  onSaved: (item: MenuItem) => void;
  onCancel: () => void;
}) {
  const isBranch = tone === "branch";
  const existingMain = item
    ? subs.find((s) => s.id === item.sub_category_id)?.main_category_id ?? ""
    : "";

  const [mainId, setMainId] = useState(existingMain);
  const [subId, setSubId] = useState(item?.sub_category_id ?? "");
  const [dietary, setDietary] = useState<string[]>(item?.dietary_tags ?? []);
  const [allergens, setAllergens] = useState<string[]>(item?.allergen_tags ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalDraft, setInternalDraft] = useState<MenuItemDraft>(() => emptyDraft(item));
  const { media } = useMediaLibrary();
  const [visibleMedia, setVisibleMedia] = useState(MEDIA_PAGE_SIZE);

  const draft = controlledDraft ?? internalDraft;
  const onDraftChange =
    controlledOnDraftChange ?? ((patch: Partial<MenuItemDraft>) => setInternalDraft((d) => ({ ...d, ...patch })));
  const { title, description, price, pictures } = draft;

  const availableSubs = subs.filter((s) => s.main_category_id === mainId);

  // Keeps draft.picture (read by the admin live-preview panel) mirroring
  // pictures[0], same as the backend does on save.
  function setPictures(next: string[]) {
    onDraftChange({ pictures: next, picture: next[0] ?? null });
  }

  function toggle(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  async function handlePicture(e: React.ChangeEvent<HTMLInputElement>) {
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

      const res = await fetch(`${API_URL}/uploads/images?folder=menu-items`, {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Upload failed.");
      }
      const { url } = await res.json();
      setPictures([...pictures, url].slice(0, MAX_PICTURES));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploading(false);
    }
  }

  function removePicture(url: string) {
    setPictures(pictures.filter((p) => p !== url));
  }

  function togglePicture(url: string) {
    if (pictures.includes(url)) {
      removePicture(url);
    } else if (pictures.length < MAX_PICTURES) {
      setPictures([...pictures, url]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!subId) {
      setError("Please choose a subcategory.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        sub_category_id: subId,
        title,
        description: description || null,
        price: Number(price),
        pictures,
        dietary_tags: dietary,
        allergen_tags: allergens,
      };

      const saved = item
        ? await apiFetch(`/staff/menu/menu-items/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : await apiFetch("/staff/menu/menu-items", {
            method: "POST",
            body: JSON.stringify(body),
          });

      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this item.");
    } finally {
      setSaving(false);
    }
  }

  if (isBranch) {
    return (
      <form onSubmit={handleSubmit}>
        <fieldset disabled={saving} className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="item-pic">
              Photos <span className="font-normal text-slate-muted">({pictures.length}/{MAX_PICTURES})</span>
            </Label>
            {pictures.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {pictures.map((url) => (
                  <div key={url} className="relative overflow-hidden rounded-xl border border-slate-border">
                    <img src={url} alt="" className="h-24 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePicture(url)}
                      className="absolute right-1 top-1 rounded-md bg-navy/70 px-1.5 py-0.5 text-[10px] text-white hover:bg-navy"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            {pictures.length < MAX_PICTURES && (
              <label
                htmlFor="item-pic"
                className="flex h-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-border bg-slate-bg/40 text-sm text-slate-muted hover:border-emerald/50"
              >
                {uploading ? "Uploading…" : "Click to add a photo"}
              </label>
            )}
            <input
              id="item-pic"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePicture}
              className="hidden"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="item-main">Main category</Label>
              <select
                id="item-main"
                required
                value={mainId}
                onChange={(e) => {
                  setMainId(e.target.value);
                  setSubId("");
                }}
                className="h-10 w-full rounded-lg border border-slate-border bg-white px-3 text-sm"
              >
                <option value="">Choose…</option>
                {mains.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="item-sub">Subcategory</Label>
              <select
                id="item-sub"
                required
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                disabled={!mainId}
                className="h-10 w-full rounded-lg border border-slate-border bg-white px-3 text-sm disabled:bg-slate-bg"
              >
                <option value="">{mainId ? "Choose…" : "Pick a main category first"}</option>
                {availableSubs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="item-title">Name</Label>
            <Input
              id="item-title"
              required
              value={title}
              onChange={(e) => onDraftChange({ title: e.target.value })}
              className="border-slate-border"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="item-desc">Description</Label>
            <Input
              id="item-desc"
              value={description}
              onChange={(e) => onDraftChange({ description: e.target.value })}
              className="border-slate-border"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="item-price">Price (£)</Label>
            <Input
              id="item-price"
              type="number"
              step="0.01"
              min="0"
              required
              value={price}
              onChange={(e) => onDraftChange({ price: e.target.value })}
              className="border-slate-border"
            />
          </div>

          <div className="space-y-2">
            <Label>Dietary</Label>
            <TagPicker
              tone="branch"
              variant="success"
              options={DIETARY}
              selected={dietary}
              onToggle={(t) => toggle(dietary, setDietary, t)}
            />
          </div>

          <div className="space-y-2">
            <Label>Allergens</Label>
            <TagPicker
              tone="branch"
              variant="warning"
              options={ALLERGENS}
              selected={allergens}
              onToggle={(t) => toggle(allergens, setAllergens, t)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={saving || uploading}
              className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
            >
              {saving ? "Saving…" : item ? "Save changes" : "Add item"}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-subtle">
              Cancel
            </Button>
          </div>
        </fieldset>
      </form>
    );
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
          <p>
            Pictures <span className="admin-muted">({pictures.length}/{MAX_PICTURES})</span>
          </p>
          {pictures.length > 0 && (
            <button type="button" className="admin-add-bit" onClick={() => setPictures([])}>
              Clear
            </button>
          )}
        </div>
        {/* Pulled from the real /admin/media library — a 3×3 grid, same
            shape as the event composer's gallery, with a "More" button
            to reveal the next nine once the library outgrows one page.
            Up to 5 selections — the guest phone opens them as a carousel,
            in the order picked. */}
        <div className="admin-media-grid is-quick">
          {Array.from({ length: Math.max(MEDIA_PAGE_SIZE, Math.min(visibleMedia, media.length)) }, (_, i) => {
            const item = media[i];
            if (!item) {
              return (
                <button key={`empty-${i}`} type="button" className="is-none" disabled>
                  <span>No image</span>
                </button>
              );
            }
            const thumb = mediaThumb(item);
            const order = pictures.indexOf(thumb);
            const selected = order !== -1;
            return (
              <button
                key={item.id}
                type="button"
                className={`${item.kind === "video" ? "is-film " : ""}${selected ? "is-on" : ""}`.trim()}
                aria-pressed={selected}
                disabled={!selected && pictures.length >= MAX_PICTURES}
                onClick={() => togglePicture(thumb)}
              >
                {thumb && <img src={thumb} alt="" />}
                <span>{selected ? `${order + 1} · ${item.label}` : item.label}</span>
              </button>
            );
          })}
        </div>
        {visibleMedia < media.length && (
          <button
            type="button"
            className="admin-ghost mb-3"
            onClick={() => setVisibleMedia((v) => v + MEDIA_PAGE_SIZE)}
          >
            More
          </button>
        )}

        <div className="admin-row">
          <label>
            Main category
            <select
              required
              value={mainId}
              onChange={(e) => {
                setMainId(e.target.value);
                setSubId("");
              }}
            >
              <option value="">Choose…</option>
              {mains.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Subcategory
            <select
              required
              value={subId}
              onChange={(e) => setSubId(e.target.value)}
              disabled={!mainId}
            >
              <option value="">{mainId ? "Choose…" : "Pick a main category first"}</option>
              {availableSubs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Name
          <input required value={title} onChange={(e) => onDraftChange({ title: e.target.value })} />
        </label>

        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => onDraftChange({ description: e.target.value })}
          />
        </label>

        <label>
          Price (£)
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={price}
            onChange={(e) => onDraftChange({ price: e.target.value })}
          />
        </label>

        <label>Dietary</label>
        <div className="mb-3">
          <TagPicker tone="admin" options={DIETARY} selected={dietary} onToggle={(t) => toggle(dietary, setDietary, t)} />
        </div>

        <label>Allergens</label>
        <div className="mb-3">
          <TagPicker
            tone="admin"
            options={ALLERGENS}
            selected={allergens}
            onToggle={(t) => toggle(allergens, setAllergens, t)}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" className="admin-book" disabled={saving}>
            {saving ? "Saving…" : item ? "Save changes" : "Add item"}
          </button>
          <button type="button" className="admin-book" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
