"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MainCategory, SubCategory, MenuItem } from "./menu-browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

const DIETARY = ["vegetarian", "vegan", "gluten_free", "dairy_free", "halal", "low_calorie"];
const ALLERGENS = ["nuts", "peanuts", "dairy", "eggs", "gluten", "shellfish", "soy", "sesame"];

function TagPicker({
  options,
  selected,
  onToggle,
  tone,
}: {
  options: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  tone: "success" | "warning";
}) {
  const styles =
    tone === "success"
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

export function MenuItemForm({
  item,
  mains,
  subs,
  onSaved,
  onCancel,
}: {
  item?: MenuItem;
  mains: MainCategory[];
  subs: SubCategory[];
  onSaved: (item: MenuItem) => void;
  onCancel: () => void;
}) {
  const existingMain = item
    ? subs.find((s) => s.id === item.sub_category_id)?.main_category_id ?? ""
    : "";

  const [mainId, setMainId] = useState(existingMain);
  const [subId, setSubId] = useState(item?.sub_category_id ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [picture, setPicture] = useState<string | null>(item?.picture ?? null);
  const [dietary, setDietary] = useState<string[]>(item?.dietary_tags ?? []);
  const [allergens, setAllergens] = useState<string[]>(item?.allergen_tags ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSubs = subs.filter((s) => s.main_category_id === mainId);

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
      setPicture(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploading(false);
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
        picture,
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

        {/* Photo */}
        <div className="space-y-2">
          <Label htmlFor="item-pic">Photo</Label>
          {picture ? (
            <div className="relative overflow-hidden rounded-xl border border-slate-border">
              <img src={picture} alt="" className="h-40 w-full object-cover" />
              <button
                type="button"
                onClick={() => setPicture(null)}
                className="absolute right-2 top-2 rounded-md bg-navy/70 px-2.5 py-1 text-xs text-white hover:bg-navy"
              >
                Remove
              </button>
            </div>
          ) : (
            <label
              htmlFor="item-pic"
              className="flex h-32 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-border bg-slate-bg/40 text-sm text-slate-muted hover:border-emerald/50"
            >
              {uploading ? "Uploading…" : "Click to upload a photo"}
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
            onChange={(e) => setTitle(e.target.value)}
            className="border-slate-border"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="item-desc">Description</Label>
          <Input
            id="item-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
            onChange={(e) => setPrice(e.target.value)}
            className="border-slate-border"
          />
        </div>

        <div className="space-y-2">
          <Label>Dietary</Label>
          <TagPicker
            options={DIETARY}
            selected={dietary}
            onToggle={(t) => toggle(dietary, setDietary, t)}
            tone="success"
          />
        </div>

        <div className="space-y-2">
          <Label>Allergens</Label>
          <TagPicker
            options={ALLERGENS}
            selected={allergens}
            onToggle={(t) => toggle(allergens, setAllergens, t)}
            tone="warning"
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