"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
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

/** "sunset-terrace_02.jpg" -> "Sunset Terrace 02" — the auto-label used by
   both bulk-import paths when nothing in the source names the picture. */
function labelFromFilename(name: string): string {
  const base = name.replace(/\.[^/.]+$/, "");
  return base
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ") || "Untitled";
}

function labelFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return labelFromFilename(decodeURIComponent(path.split("/").pop() || "Untitled"));
  } catch {
    return "Untitled";
  }
}

/** The reverse of labelFromFilename, for export — a media item's label
   back into a safe filename, keeping the real extension from its URL. */
function filenameFor(label: string, url: string): string {
  const ext = (url.split("?")[0].split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const base = label.trim().replace(/[^a-z0-9\- _]+/gi, "").replace(/\s+/g, "-") || "media";
  return `${base}.${ext}`;
}

/** A JSON media list — either a bare array, or {"images": [...]}. Each row
   is a plain URL (label auto-derived) or an object for when the file names
   aren't good labels on their own. These point at already-hosted files, so
   importing skips /uploads/images entirely and posts straight to /media. */
type JsonMediaEntry =
  | string
  | { label?: string; src?: string; url?: string; kind?: string; alt?: string; poster?: string };

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

  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const [exportLabel, setExportLabel] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

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

  /** Import every image in a chosen folder at once — one upload + one
     /media row per file, label auto-derived from its filename. Videos
     aren't supported here (a film needs a separately-chosen poster, which
     a folder drop can't express), so non-images are counted and skipped
     rather than failing the whole batch. */
  async function importFolder(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    const skipped = fileList.length - files.length;
    if (files.length === 0) {
      setImportMsg(skipped ? `No images in that folder — ${skipped} file(s) skipped.` : "No files found.");
      return;
    }

    setImporting(true);
    setError(null);
    setImportMsg(null);

    const created: MediaItem[] = [];
    const failures: string[] = [];

    for (const f of files) {
      try {
        const src = await uploadFile(f);
        const rowLabel = labelFromFilename(f.name);
        const rowKind: Kind = f.type === "image/gif" ? "gif" : "still";
        const row = await apiFetch("/media", {
          method: "POST",
          body: JSON.stringify({ label: rowLabel, kind: rowKind, src, poster: null, alt: rowLabel }),
        });
        created.push(row);
      } catch (err) {
        failures.push(`${f.name}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    setItems((prev) => [...created, ...prev]);
    setImporting(false);
    setImportMsg(
      `Added ${created.length} of ${files.length} image(s)` +
        (skipped ? ` (${skipped} non-image file(s) skipped)` : "") +
        "." +
        (failures.length ? ` Failed: ${failures.join("; ")}` : "")
    );
  }

  /** Import a JSON list of already-hosted images/films — skips
     /uploads/images entirely since these point at existing URLs, and posts
     straight to /media. Accepts a bare array or {"images": [...]}, each
     row a plain URL or an object when the URL's filename isn't a good
     label on its own. */
  async function importJsonFile(jsonFile: File | null) {
    if (!jsonFile) return;

    setImporting(true);
    setError(null);
    setImportMsg(null);

    try {
      const parsed = JSON.parse(await jsonFile.text());
      const rows: JsonMediaEntry[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.images)
        ? parsed.images
        : [];

      if (rows.length === 0) {
        setImportMsg('That JSON file doesn\'t look like a media list — expected an array, or an "images" array.');
        setImporting(false);
        return;
      }

      const created: MediaItem[] = [];
      const failures: string[] = [];

      for (const entry of rows) {
        const obj = typeof entry === "string" ? { src: entry } : entry;
        const src = obj.src || obj.url;
        if (!src) {
          failures.push("(entry missing src/url)");
          continue;
        }
        const rowKind: Kind = obj.kind === "video" || obj.kind === "gif" ? obj.kind : "still";
        if (rowKind === "video" && !obj.poster) {
          failures.push(`${src}: a film needs a "poster" URL in the JSON too`);
          continue;
        }
        const rowLabel = obj.label || labelFromUrl(src);
        try {
          const row = await apiFetch("/media", {
            method: "POST",
            body: JSON.stringify({
              label: rowLabel,
              kind: rowKind,
              src,
              poster: obj.poster ?? null,
              alt: obj.alt || rowLabel,
            }),
          });
          created.push(row);
        } catch (err) {
          failures.push(`${rowLabel}: ${err instanceof Error ? err.message : "failed"}`);
        }
      }

      setItems((prev) => [...created, ...prev]);
      setImportMsg(
        `Added ${created.length} of ${rows.length} from the file.` +
          (failures.length ? ` Failed: ${failures.join("; ")}` : "")
      );
    } catch {
      setImportMsg("Couldn't read that as JSON.");
    } finally {
      setImporting(false);
    }
  }

  /** Bundle every item in the library into one .zip for download — a
     backup, or just a way to get everything out of here at once. Each
     item's own file (src) goes in named after its label; a film's poster
     goes in too, suffixed "-poster", since it's a distinct asset that a
     backup would otherwise lose. Fetched directly from Supabase storage in
     the browser — public bucket URLs, no auth needed for the GET itself. */
  async function exportAll() {
    if (items.length === 0) {
      setExportMsg("Nothing to export — the library is empty.");
      return;
    }

    setExporting(true);
    setError(null);
    setExportMsg(null);

    const zip = new JSZip();
    const used = new Set<string>();
    const failures: string[] = [];

    function uniqueName(label: string, url: string): string {
      let name = filenameFor(label, url);
      let n = 2;
      while (used.has(name)) {
        name = filenameFor(`${label}-${n}`, url);
        n += 1;
      }
      used.add(name);
      return name;
    }

    for (const item of items) {
      try {
        const res = await fetch(item.src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        zip.file(uniqueName(item.label, item.src), await res.blob());
      } catch (err) {
        failures.push(`${item.label}: ${err instanceof Error ? err.message : "failed"}`);
      }

      if (item.kind === "video" && item.poster) {
        try {
          const res = await fetch(item.poster);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          zip.file(uniqueName(`${item.label}-poster`, item.poster), await res.blob());
        } catch (err) {
          failures.push(`${item.label} (poster): ${err instanceof Error ? err.message : "failed"}`);
        }
      }
    }

    const archiveName = exportLabel.trim() || `sweet1ne-media-${new Date().toISOString().slice(0, 10)}`;

    try {
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${archiveName.replace(/[^a-z0-9\- _]+/gi, "").replace(/\s+/g, "-") || "sweet1ne-media"}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExportMsg(
        `Downloaded ${used.size} file(s) in ${archiveName}.zip.` +
          (failures.length ? ` Failed: ${failures.join("; ")}` : "")
      );
    } catch (err) {
      setExportMsg(err instanceof Error ? `Couldn't build the zip: ${err.message}` : "Couldn't build the zip.");
    } finally {
      setExporting(false);
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
      {importMsg && <p className="admin-dek mb-3 text-sm">{importMsg}</p>}
      {exportMsg && <p className="admin-dek mb-3 text-sm">{exportMsg}</p>}

      <div className="admin-tools mb-3">
        <input
          placeholder={`sweet1ne-media-${new Date().toISOString().slice(0, 10)}`}
          value={exportLabel}
          onChange={(e) => setExportLabel(e.target.value)}
          disabled={exporting}
        />
        <button type="button" className="admin-ghost" disabled={exporting} onClick={exportAll}>
          {exporting ? "Exporting…" : "Export all (.zip)"}
        </button>
      </div>

      <div className="admin-tools mb-3">
        <label className="admin-ghost" style={{ cursor: importing ? "default" : "pointer" }}>
          {importing ? "Importing…" : "Import folder"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={importing}
            style={{ display: "none" }}
            // Non-standard but supported by every Chromium/Firefox/Safari
            // desktop build — the only way a plain <input type="file"> can
            // offer "pick a folder" instead of individual files.
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(e) => {
              importFolder(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className="admin-ghost" style={{ cursor: importing ? "default" : "pointer" }}>
          {importing ? "Importing…" : "Import JSON"}
          <input
            type="file"
            accept="application/json"
            disabled={importing}
            style={{ display: "none" }}
            onChange={(e) => {
              importJsonFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
      </div>

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
