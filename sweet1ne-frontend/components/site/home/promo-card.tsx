"use client";

import { useEffect, useState } from "react";
import { getGuestId } from "@/lib/guest-id";
import {
  heroImageOf,
  BANNER_POSITION_COORDS,
  liveButtons,
  buttonHref,
  buttonLabel,
  offerText,
  type NoteBlock,
  type PublicPromotion,
} from "@/lib/promotion-blocks";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
// Same dismissal convention as the header ribbon (components/site/promo-ribbon.tsx)
// — stored against the promotion's own id, just its own prefix since this
// is a different surface with its own independent on/off state.
const DISMISS_PREFIX = "sweet1ne_promo_card_dismissed_";

/** The "After they enter" surface — a floating, rounded card, fixed above
   the bottom of the viewport on every page (mounted once in the shared
   site layout, same as the header ribbon). Classes (.promo-stage, .promo,
   .promo-still, .promo-copy, ...) and the #promo-stage id match the
   template's own promo.css/promo.js naming, with the circular-still/
   centred-copy treatment `#promo-stage .promo` applies on top of the base
   card shape. */
export function PromoCard() {
  const [promotion, setPromotion] = useState<PublicPromotion | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const guestId = getGuestId();

    fetch(`${API_URL}/public/site/promotions?surface=enter${guestId ? `&guest_id=${guestId}` : ""}`)
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
  const off = offerText(promotion.offer, promotion.off);
  const note = promotion.layout.find(
    (b): b is NoteBlock => b.type === "note" && Boolean(b.text),
  )?.text;
  const buttons = liveButtons(promotion.buttons);

  return (
    <div
      id="promo-stage"
      className="promo-stage is-ready"
      onClick={(e) => e.stopPropagation()}
    >
      <article
        className="promo"
        data-kind={promotion.kind}
        data-still={promotion.look.still}
        data-size={promotion.look.still_size || "m"}
        data-tone={promotion.look.tone}
        data-align={promotion.look.align}
      >
        {showStill && (
          <div className="promo-still">
            <img src={imageUrl} alt="" style={stillStyle} />
          </div>
        )}
        <div className="promo-copy">
          {promotion.kicker && <p className="promo-kicker">{promotion.kicker}</p>}
          <h2 className="promo-title">{promotion.title}</h2>
          {promotion.dek && <p className="promo-dek">{promotion.dek}</p>}
          {note && <p className="promo-note">{note}</p>}
          {promotion.code && <p className="promo-code">{promotion.code}</p>}
          {off && <p className="promo-off">{off}</p>}
          {!(promotion.kind === "code" && promotion.code) && buttons.length > 0 && (
            <div className="promo-ctas">
              {buttons.map((btn, i) => (
                <a
                  key={btn.id}
                  className={`promo-cta${i === 0 ? " is-filled" : ""}`}
                  href={buttonHref(btn)}
                >
                  {buttonLabel(btn)}
                </a>
              ))}
            </div>
          )}
        </div>
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
      </article>
    </div>
  );
}
