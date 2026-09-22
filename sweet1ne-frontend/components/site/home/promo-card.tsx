"use client";

import { useEffect, useState } from "react";
import { useStage } from "./stage-provider";
import { getGuestId } from "@/lib/guest-id";
import { CTA_PRESETS, type PromotionCtaKind } from "@/lib/promotion-blocks";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type Promotion = {
  id: string;
  title: string;
  kicker: string | null;
  dek: string | null;
  cta: PromotionCtaKind;
  cta_label: string | null;
};

/** The homepage card after Enter Sweet1NE — a real, live "enter"-surface
   promotion, or nothing. Never shown on the film itself: it only renders
   once the gate has actually opened. */
export function PromoCard() {
  const { gated } = useStage();
  const [promotion, setPromotion] = useState<Promotion | null>(null);

  useEffect(() => {
    if (gated) return;
    let cancelled = false;
    const guestId = getGuestId();

    fetch(`${API_URL}/public/site/promotions?surface=enter${guestId ? `&guest_id=${guestId}` : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Promotion | null) => {
        if (!cancelled) setPromotion(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [gated]);

  if (gated || !promotion) return null;

  return (
    <section className="promo-card mx-auto max-w-3xl px-5 py-10 text-center sm:px-8">
      {promotion.kicker && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
          {promotion.kicker}
        </p>
      )}
      <h2 className="mt-2 font-display text-2xl text-[#e5e2e1] sm:text-3xl">{promotion.title}</h2>
      {promotion.dek && <p className="mt-3 text-[#a8a4a2]">{promotion.dek}</p>}
      <a
        href={CTA_PRESETS[promotion.cta].href}
        className="mt-5 inline-block border border-[rgba(201,162,74,.9)] px-6 py-3 text-sm font-semibold text-[var(--gold)] transition-colors hover:bg-[var(--gold)] hover:text-[#0e0e0e]"
      >
        {promotion.cta_label || CTA_PRESETS[promotion.cta].label}
      </a>
    </section>
  );
}
