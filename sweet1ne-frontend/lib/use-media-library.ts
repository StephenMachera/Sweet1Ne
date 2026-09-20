"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type MediaKind = "still" | "gif" | "video";

export type MediaItem = {
  id: string;
  label: string;
  kind: MediaKind;
  src: string;
  poster: string | null;
  alt: string | null;
  locked: boolean;
  created_at: string;
};

/** The still to actually show/use for an item — a video's poster, not its file. */
export function mediaThumb(item: MediaItem): string {
  if (item.kind === "video") return item.poster || item.src;
  return item.src;
}

/** The real /admin/media library, for the menu and event composer's
   picture pickers — replaces the old TEST_MEDIA stand-in now that the
   Media page and its API exist. */
export function useMediaLibrary() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/media")
      .then((rows: MediaItem[]) => {
        if (!cancelled) setMedia(rows);
      })
      .catch(() => {
        if (!cancelled) setMedia([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { media, loading };
}
