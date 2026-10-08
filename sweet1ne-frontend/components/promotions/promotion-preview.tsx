"use client";

import {
  heroImageOf,
  BANNER_POSITION_COORDS,
  offerText,
  liveButtons,
  buttonHref,
  buttonLabel,
  type PromotionBlock,
  type PromotionBlockType,
  type PromotionButton,
  type StillSize,
  type NoteBlock,
} from "@/lib/promotion-blocks";

export type PromotionPreviewData = {
  kicker: string | null;
  title: string;
  dek: string | null;
  layout: PromotionBlock[];
  buttons: PromotionButton[];
  look: {
    still: string;
    tone: string;
    align: string;
    background_image: string | null;
    still_size: StillSize;
  };
  kind: string;
  code: string | null;
  offer: string;
  off: number | null;
};

/** The three surfaces render genuinely different shapes — not one card
   reused with different wrappers around it. "After they enter" is the real
   homepage popup (photo + copy); the quiet line is a single-line bar with
   no photo; the table phone is a compact stacked card with no photo and no
   button. Matches the reference build's three separate templates
   (htmlEnter/htmlRibbon/htmlPhone in promo.js) rather than its one shared
   fillCopy() output. */
export function PromotionPreview({
  data,
  surface,
  defaultImage,
}: {
  data: PromotionPreviewData;
  surface: "enter" | "ribbon" | "phone";
  // Fallback for the "enter" surface when no hero image has been picked
  // yet — the tenant's own most recent upload, not a stock photo.
  defaultImage?: string;
}) {
  const hasType = (t: PromotionBlockType) =>
    data.layout.some((b) => b.type === t);
  const notes = data.layout.filter(
    (b): b is NoteBlock => b.type === "note" && Boolean(b.text),
  );
  const kicker = hasType("kicker") ? data.kicker || "Now" : "";
  const title = hasType("title") ? data.title || "Title sits here." : "";
  const dek = hasType("dek") ? data.dek : null;
  const code = data.kind === "code" ? data.code : null;
  const off = offerText(data.offer, data.off);
  // A code promotion applies itself at the table phone — no buttons needed
  // on the surfaces that show the code.
  const buttons = hasType("ctas") && !(data.kind === "code" && code) ? liveButtons(data.buttons) : [];
  const hero = heroImageOf(data.layout);
  const imageUrl = hero?.image_url || defaultImage || "";
  const objectPosition = BANNER_POSITION_COORDS[hero?.position ?? "center"];
  const objectFit = hero?.fit === "fit" ? "contain" : "cover";
  const scale = hero?.scale ?? 100;
  const stillStyle = {
    objectFit,
    objectPosition,
    transform: scale === 100 ? undefined : `scale(${scale / 100})`,
    transformOrigin: objectPosition,
  } as const;

  const showStill = data.look.still !== "none" && Boolean(imageUrl);

  if (surface === "ribbon") {
    return (
      <div
        className="promo-ribbon"
        data-still={data.look.still}
        data-size={data.look.still_size}
        data-tone={data.look.tone}
      >
        {showStill && (
          <div className="promo-still">
            <img src={imageUrl} alt="" style={stillStyle} />
          </div>
        )}
        <div className="promo-copy">
          {kicker && <p className="promo-kicker">{kicker}</p>}
          {title && <p className="promo-title">{title}</p>}
        </div>
        {code && <p className="promo-code">{code}</p>}
        {buttons.length > 0 && (
          <div className="promo-ctas">
            {buttons.map((btn, i) => (
              <a
                key={btn.id}
                className={`promo-cta${i === 0 ? " is-filled" : ""}`}
                href={buttonHref(btn)}
                onClick={(e) => e.stopPropagation()}
              >
                {buttonLabel(btn)}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (surface === "phone") {
    return (
      <div
        className="promo-phone"
        data-still={data.look.still}
        data-size={data.look.still_size}
        data-tone={data.look.tone}
      >
        {showStill && (
          <div className="promo-still">
            <img src={imageUrl} alt="" style={stillStyle} />
          </div>
        )}
        <div className="promo-copy">
          {kicker && <p className="promo-kicker">{kicker}</p>}
          {title && <p className="promo-title">{title}</p>}
          {dek && <p className="promo-dek">{dek}</p>}
          {off && <p className="promo-off">{off}</p>}
          {code && <p className="promo-code">{code}</p>}
          {buttons.length > 0 && (
            <div className="promo-ctas">
              {buttons.map((btn, i) => (
                <a
                  key={btn.id}
                  className={`promo-cta${i === 0 ? " is-filled" : ""}`}
                  href={buttonHref(btn)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {buttonLabel(btn)}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <article
      className="promo"
      data-kind={data.kind}
      data-still={data.look.still}
      data-size={data.look.still_size}
      data-tone={data.look.tone}
      data-align={data.look.align}
    >
      {showStill && (
        <div className="promo-still">
          <img src={imageUrl} alt="" style={stillStyle} />
        </div>
      )}
      <div className="promo-copy">
        {kicker && <p className="promo-kicker">{kicker}</p>}
        {title && <p className="promo-title">{title}</p>}
        {dek && <p className="promo-dek">{dek}</p>}
        {notes.map((n) => (
          <p key={n.id} className="promo-note">
            {n.text}
          </p>
        ))}
        {code && <p className="promo-code">{code}</p>}
        {off && <p className="promo-off">{off}</p>}
        {buttons.length > 0 && (
          <div className="promo-ctas">
            {buttons.map((btn, i) => (
              <a
                key={btn.id}
                className={`promo-cta${i === 0 ? " is-filled" : ""}`}
                href={buttonHref(btn)}
                onClick={(e) => e.stopPropagation()}
              >
                {buttonLabel(btn)}
              </a>
            ))}
          </div>
        )}
      </div>
      {/* Decorative here — the Frame around this preview is itself the
         surface's on/off toggle, so this just mirrors the real close
         button's look rather than wiring its own dismiss state. */}
      <span className="promo-close" aria-hidden>
        ×
      </span>
    </article>
  );
}
