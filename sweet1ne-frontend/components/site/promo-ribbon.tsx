"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getGuestId } from "@/lib/guest-id";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const DISMISS_PREFIX = "sweet1ne_ribbon_dismissed_";

type Promotion = {
  id: string;
  title: string;
  kicker: string | null;
  dek: string | null;
};

/**
 * The quiet line under the header — shows a real, live "ribbon"-surface
 * promotion, or nothing at all. Dismissal is stored against the
 * promotion's own id, so closing it hides that one for good while a
 * different promotion going live later still gets shown.
 */
export function PromoRibbon() {
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const guestId = getGuestId();

    fetch(`${API_URL}/public/site/promotions?surface=ribbon${guestId ? `&guest_id=${guestId}` : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Promotion | null) => {
        if (cancelled || !data) return;
        setDismissed(Boolean(window.localStorage.getItem(`${DISMISS_PREFIX}${data.id}`)));
        setPromotion(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const showing = promotion !== null && !dismissed;

  useEffect(() => {
    // The header is fixed at top:0 — nudge it down while the ribbon is
    // showing, rather than letting the ribbon sit underneath it unseen.
    document.body.classList.toggle("has-ribbon", showing);
    return () => document.body.classList.remove("has-ribbon");
  }, [showing]);

  if (!showing || !promotion) return null;

  return (
    <div className="site-ribbon fixed inset-x-0 top-0 z-[80] flex h-9 items-center justify-center gap-3 border-b border-[#c9a24a]/25 bg-[#141210] px-4 text-center text-sm text-[#e5e2e1] transition-opacity duration-500">
      <span>
        {promotion.kicker && <strong className="mr-1 text-[#c9a24a]">{promotion.kicker}</strong>}
        {promotion.title}
        {promotion.dek && <span className="text-[#a8a4a2]"> — {promotion.dek}</span>}
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        className="shrink-0 text-[#a8a4a2] hover:text-[#e5e2e1]"
        onClick={() => {
          window.localStorage.setItem(`${DISMISS_PREFIX}${promotion.id}`, "1");
          setDismissed(true);
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
