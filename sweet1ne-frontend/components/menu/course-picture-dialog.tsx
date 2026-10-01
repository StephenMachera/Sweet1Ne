"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useMediaLibrary, mediaThumb } from "@/lib/use-media-library";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MainCategory } from "./menu-browser";

const MEDIA_PAGE_SIZE = 9;

// Dialog portals to document.body, outside .admin-shell — var(--x) tokens
// only cascade under that class, so literal values stand in here, same
// fix as every other admin dialog.
const DARK_DIALOG =
  "border border-[rgba(201,162,74,0.42)] bg-[#0c0c0c] text-[#e5e2e1] sm:max-w-lg max-h-[90vh] overflow-y-auto";
const DIALOG_GHOST_BTN =
  "px-[1.15rem] py-[0.6rem] text-[0.75rem] uppercase tracking-[0.1em] text-[rgba(229,226,225,0.68)] hover:text-[#e5e2e1]";

/** One course's picture — decorative chrome on its filter pill and chapter
 *  header (menu board), and on its row in the Main categories list, picked
 *  from the same media library as item pictures. A single selection, not a
 *  gallery — this is chrome, not a dish. Shared by both places it's set. */
export function CoursePictureDialog({
  category,
  onClose,
  onSaved,
}: {
  category: MainCategory | null;
  onClose: () => void;
  onSaved: (updated: MainCategory) => void;
}) {
  const { media } = useMediaLibrary();
  const [visibleMedia, setVisibleMedia] = useState(MEDIA_PAGE_SIZE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(url: string) {
    if (!category) return;
    const next = category.picture === url ? null : url;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/staff/menu/main-categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ picture: next }),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that picture.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={category !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={DARK_DIALOG}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-[#e5e2e1]">
            {category?.name} — course picture
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[rgba(229,226,225,0.68)]">
          This medal sits on the website. The table phone uses the dish pictures.
        </p>
        {error && <p className="admin-hold text-xs">{error}</p>}
        <div className="admin-media-grid is-compact">
          {media.slice(0, visibleMedia).map((item) => {
            const thumb = mediaThumb(item);
            const selected = category?.picture === thumb;
            return (
              <button
                key={item.id}
                type="button"
                className={`${item.kind === "video" ? "is-film " : ""}${selected ? "is-on" : ""}`.trim()}
                aria-pressed={selected}
                disabled={saving}
                onClick={() => pick(thumb)}
              >
                {thumb && <img src={thumb} alt="" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        {visibleMedia < media.length && (
          <button
            type="button"
            className="admin-ghost"
            onClick={() => setVisibleMedia((v) => v + MEDIA_PAGE_SIZE)}
          >
            More images
          </button>
        )}
        <div className="flex justify-end pt-2">
          <button type="button" className={DIALOG_GHOST_BTN} onClick={onClose}>
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
