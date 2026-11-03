"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { stopTracking, trackWebsiteEvent } from "@/lib/track";

function cleanReferrer(raw: string): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.origin === window.location.origin ? undefined : `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

/** Records a page view on every public page, skipping signed-in staff so
 * testing doesn't skew the numbers. Mounted in the public layout only. */
export function PageTracker() {
  const pathname = usePathname();
  const staffChecked = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!staffChecked.current) {
      staffChecked.current = (async () => {
        try {
          const { data } = await createClient().auth.getSession();
          if (data.session) stopTracking();
        } catch {}
      })();
    }

    let cancelled = false;
    staffChecked.current.then(() => {
      if (cancelled) return;
      trackWebsiteEvent({ type: "page_view", path: pathname, referrer: cleanReferrer(document.referrer) });
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
