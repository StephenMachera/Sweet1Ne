"use client";

import { useEffect, useState } from "react";
import { getGuestId } from "@/lib/guest-id";
import {
  heroImageOf,
  BANNER_POSITION_COORDS,
  liveButtons,
  buttonHref,
  buttonLabel,
  type PublicPromotion,
} from "@/lib/promotion-blocks";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const DISMISS_PREFIX = "sweet1ne_ribbon_dismissed_";

/**
 * The quiet line under the header — a real, live "ribbon"-surface
 * promotion, or nothing at all. Markup and classes (.promo-ribbon,
 * .promo-still, .promo-copy, .promo-kicker, .promo-title, .promo-code,
 * .promo-cta, .promo-close) match the template's htmlRibbon() exactly —
 * same id (#promo-ribbon) so the fixed-position + layout-push rules in
 * site.css key on it. Dismissal is stored against the promotion's own id,
 * so closing it hides that one for good while a later promotion still gets
 * shown.
 */
export function PromoRibbon() {
  const [promotion, setPromotion] = useState<PublicPromotion | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const guestId = getGuestId();

    fetch(`${API_URL}/public/site/promotions?surface=ribbon${guestId ? `&guest_id=${guestId}` : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PublicPromotion | null) => {
        if (cancelled || !data) return;
        setDismissed(Boolean(window.localStorage.getItem(`${DISMISS_PREFIX}${data.id}`)));
        setPromotion(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (!promotion || dismissed) return null;

  const hero = heroImageOf(promotion.layout);
  const imageUrl = hero?.image_url || "";
  const objectPosition = BANNER_POSITION_COORDS[hero?.position ?? "center"];
  const objectFit = hero?.fit === "fit" ? "contain" : "cover";
  const scale = hero?.scale ?? 100;
  const stillStyle = {
    objectFit,
    objectPosition,
    transform: scale === 100 ? undefined : `scale(${scale / 100})`,
    transformOrigin: objectPosition,
  } as const;
  const showStill = promotion.look.still !== "none" && Boolean(imageUrl);
  const buttons = liveButtons(promotion.buttons);

  return (
    <div
      id="promo-ribbon"
      className="promo-ribbon"
      role="note"
      data-still={promotion.look.still}
      data-size={promotion.look.still_size || "m"}
      data-tone={promotion.look.tone}
    >
      {showStill && (
        <div className="promo-still">
          <img src={imageUrl} alt="" style={stillStyle} />
        </div>
      )}
      <div className="promo-copy">
        {promotion.kicker && <p className="promo-kicker">{promotion.kicker}</p>}
        <p className="promo-title">{promotion.title}</p>
      </div>
      {promotion.code && <p className="promo-code">{promotion.code}</p>}
      {!(promotion.kind === "code" && promotion.code) && buttons.length > 0 && (
        <div className="promo-ctas">
          {buttons.map((btn, i) => (
            <a key={btn.id} className={`promo-cta${i === 0 ? " is-filled" : ""}`} href={buttonHref(btn)}>
              {buttonLabel(btn)}
            </a>
          ))}
        </div>
      )}
      <button
        type="button"
        className="promo-close"
        aria-label="Close"
        onClick={() => {
          window.localStorage.setItem(`${DISMISS_PREFIX}${promotion.id}`, "1");
          setDismissed(true);
        }}
      >
        ×
      </button>
    </div>
  );
}
