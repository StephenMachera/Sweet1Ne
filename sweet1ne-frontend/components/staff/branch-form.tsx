"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RESERVED_SLUGS = ["admin", "login", "signup", "api", "auth", "static", "_next"];
const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export type Branch = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  capacity: number | null;
  image_url: string | null;
  is_active: boolean;
};

export function BranchForm({
  onCreated,
  onCancel,
}: {
  onCreated: (branch: Branch) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [capacity, setCapacity] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = slugOverride ?? slugify(name);
  const slugReserved = RESERVED_SLUGS.includes(slug);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/uploads/images?folder=branches`, {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Upload failed.");
      }

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

    if (slugReserved) {
      setError(`"${slug}" is reserved and can't be used as a branch URL.`);
      return;
    }

    setSaving(true);
    try {
      const branch = await apiFetch("/branches", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug,
          address: address || null,
          phone: phone || null,
          capacity: capacity ? Number(capacity) : null,
          image_url: imageUrl,
        }),
      });
      onCreated(branch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the branch.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={saving} className="space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded-md border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-ember"
          >
            {error}
          </div>
        )}

        {/* Image */}
        <div className="space-y-2">
          <Label htmlFor="image">Photo</Label>
          {imageUrl ? (
            <div className="relative overflow-hidden rounded-lg border border-ink/10">
              <img src={imageUrl} alt="" className="h-40 w-full object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="absolute right-2 top-2 rounded-md bg-ink/70 px-2.5 py-1 text-xs text-paper hover:bg-ink"
              >
                Remove
              </button>
            </div>
          ) : (
            <label
              htmlFor="image"
              className="flex h-40 cursor-pointer items-center justify-center rounded-lg border border-dashed border-ink/20 bg-ink/[0.02] text-sm text-ink-muted hover:border-ink/35"
            >
              {uploading ? "Uploading…" : "Click to upload a photo"}
            </label>
          )}
          <input
            id="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>

        {/* Name + slug */}
        <div className="space-y-1">
          <Label htmlFor="name">Branch name</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />

          {name && !editingSlug && (
            <p className="text-xs text-ink-muted">
              URL: sweet1ne.com/<span className="font-mono">{slug}</span>{" "}
              <button
                type="button"
                onClick={() => {
                  setSlugOverride(slug);
                  setEditingSlug(true);
                }}
                className="ml-1 underline hover:text-ink"
              >
                edit
              </button>
            </p>
          )}

          {editingSlug && (
            <div className="space-y-1 pt-2">
              <Label htmlFor="slug" className="text-xs">
                Branch URL
              </Label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-ink-muted">sweet1ne.com/</span>
                <Input
                  id="slug"
                  value={slugOverride ?? ""}
                  onChange={(e) => setSlugOverride(slugify(e.target.value))}
                  className="font-mono"
                />
              </div>
            </div>
          )}

          {slugReserved && (
            <p className="text-xs text-ember">
              "{slug}" is reserved and can't be used. Please choose another.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="address">Address</Label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min="0"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={saving || uploading || slugReserved}
            className="bg-gold text-ink hover:bg-gold/90"
          >
            {saving ? "Creating…" : "Create branch"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  );
}