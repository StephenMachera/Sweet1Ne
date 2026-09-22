"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useMe, hasPermission } from "@/lib/use-me";
import type { MediaItem, MediaKind } from "@/lib/use-media-library";
import { AdminLoading } from "@/components/admin/admin-loading";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type Kind = MediaKind;

function kindTag(m: MediaItem) {
  const bits: string[] = [];
  if (m.kind === "video") bits.push("film");
  if (m.kind === "gif") bits.push("GIF");
  if (m.locked) bits.push("house");
  return bits.length ? ` · ${bits.join(" · ")}` : "";
}

function acceptFor(kind: Kind) {
  if (kind === "video") return "video/mp4,video/webm,video/quicktime";
  if (kind === "gif") return "image/gif";
  return "image/jpeg,image/png,image/webp";
}

export default function AdminMediaPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const canManage = hasPermission(me, "manage_promotions");

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<Kind>("still");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      apiFetch("/media")
        .then(setItems)
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

  async function uploadFile(f: File): Promise<string> {
    const {
      data: { session },
    } = await createClient().auth.getSession();

    const formData = new FormData();
    formData.append("file", f);

    const res = await fetch(`${API_URL}/uploads/images?folder=media`, {
      method: "POST",
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail ?? "Upload failed.");
    }
    const { url } = await res.json();
    return url;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please choose a file.");
      return;
    }
    if (kind === "video" && !posterFile) {
      setError("Please choose a still for the film's poster.");
      return;
    }

    const form = e.currentTarget;
    setSaving(true);
    try {
      const src = await uploadFile(file);
      const poster = kind === "video" && posterFile ? await uploadFile(posterFile) : null;

      const created = await apiFetch("/media", {
        method: "POST",
        body: JSON.stringify({ label, kind, src, poster, alt: label }),
      });

      setItems((prev) => [created, ...prev]);
      form.reset();
      setKind("still");
      setLabel("");
      setFile(null);
      setPosterFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: MediaItem) {
    setError(null);
    try {
      await apiFetch(`/media/${item.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((m) => m.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that.");
    }
  }

  if (meLoading || !me || !canManage) {
    return <AdminLoading />;
  }

  return (
    <>
      <div className="admin-top">
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Media</h1>
      <p className="admin-dek">
        {loading
          ? "Photos, films and GIFs for mail, nights and the menu."
          : `${items.length} in the library — photos, films and GIFs for mail, nights and the menu.`}
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <form className="admin-tools" onSubmit={handleSubmit}>
        <select
          className="short"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as Kind);
            setFile(null);
            setPosterFile(null);
          }}
        >
          <option value="still">Photo</option>
          <option value="gif">GIF</option>
          <option value="video">Film</option>
        </select>
        <input placeholder="Label" required value={label} onChange={(e) => setLabel(e.target.value)} />
        <input
          key={`file-${kind}`}
          type="file"
          accept={acceptFor(kind)}
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {kind === "video" && (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(e) => setPosterFile(e.target.files?.[0] ?? null)}
          />
        )}
        <button className="admin-book" type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add"}
        </button>
      </form>

      {loading ? (
        <AdminLoading />
      ) : (
        <div className="admin-media-grid">
          {items.map((m) => {
            const thumb = m.kind === "video" ? m.poster : m.src;
            return (
              <button
                key={m.id}
                type="button"
                className={m.kind === "video" && !thumb ? "is-film" : undefined}
                title={m.locked ? undefined : "Remove"}
                disabled={m.locked}
                onClick={() => remove(m)}
              >
                {thumb && <img src={thumb} alt="" />}
                <span>
                  {m.label}
                  {kindTag(m)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
