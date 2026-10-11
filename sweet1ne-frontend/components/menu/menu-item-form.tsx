"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useMediaLibrary, mediaThumb } from "@/lib/use-media-library";
import type { MainCategory, SubCategory, MenuItem } from "./menu-browser";

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
  // tone is kept on the prop for every caller — branch and admin now share
  // the one .admin-bit-bar look, so it's no longer read here.
  void tone;
  void variant;

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
  /** "" means "same as category" (MainCategory.prep_station) — "kitchen"
   *  or "bar" pins this one dish to that station regardless. */
  stationOverride: "" | "kitchen" | "bar";
};

export const emptyDraft = (item?: MenuItem): MenuItemDraft => ({
  title: item?.title ?? "",
  description: item?.description ?? "",
  price: item ? String(item.price) : "",
  picture: item?.picture ?? null,
  pictures: item?.pictures?.length ? item.pictures : item?.picture ? [item.picture] : [],
  stationOverride: item?.prep_station_override === "bar" ? "bar" : item?.prep_station_override === "kitchen" ? "kitchen" : "",
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
  // tone is kept on the prop for every caller — branch and admin now share
  // the one .admin-form look, so it's no longer read here.
  void tone;
  const existingMain = item
    ? subs.find((s) => s.id === item.sub_category_id)?.main_category_id ?? ""
    : "";

  const [mainId, setMainId] = useState(existingMain);
  const [subId, setSubId] = useState(item?.sub_category_id ?? "");
  const [dietary, setDietary] = useState<string[]>(item?.dietary_tags ?? []);
  const [allergens, setAllergens] = useState<string[]>(item?.allergen_tags ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalDraft, setInternalDraft] = useState<MenuItemDraft>(() => emptyDraft(item));
  const { media } = useMediaLibrary();
  const [visibleMedia, setVisibleMedia] = useState(MEDIA_PAGE_SIZE);

  const draft = controlledDraft ?? internalDraft;
  const onDraftChange =
    controlledOnDraftChange ?? ((patch: Partial<MenuItemDraft>) => setInternalDraft((d) => ({ ...d, ...patch })));
  const { title, description, price, pictures, stationOverride } = draft;

  const availableSubs = subs.filter((s) => s.main_category_id === mainId);

  // Keeps draft.picture (read by the admin live-preview panel) mirroring
  // pictures[0], same as the backend does on save.
  function setPictures(next: string[]) {
    onDraftChange({ pictures: next, picture: next[0] ?? null });
  }

  function toggle(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
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
        prep_station_override: stationOverride || null,
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

        <label>
          Preparation
          <select
            value={stationOverride}
            onChange={(e) => onDraftChange({ stationOverride: e.target.value as MenuItemDraft["stationOverride"] })}
          >
            <option value="">Same as category</option>
            <option value="kitchen">Kitchen</option>
            <option value="bar">Bar</option>
          </select>
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
