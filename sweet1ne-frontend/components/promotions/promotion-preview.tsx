"use client";

import {
  heroImageOf,
  CTA_PRESETS,
  BANNER_POSITION_COORDS,
  offerText,
  type PromotionBlock,
  type PromotionBlockType,
  type PromotionCtaKind,
  type NoteBlock,
} from "@/lib/promotion-blocks";

export type PromotionPreviewData = {
  kicker: string | null;
  title: string;
  dek: string | null;
  layout: PromotionBlock[];
  cta: PromotionCtaKind;
  cta_label: string | null;
  look: { still: string; tone: string; align: string; background_image: string | null };
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
  const preset = CTA_PRESETS[data.cta];
  const label = data.cta_label || preset.label;
  const kicker = hasType("kicker") ? data.kicker || "Now" : "";
  const title = hasType("title") ? data.title || "Title sits here." : "";
  const dek = hasType("dek") ? data.dek : null;
  const code = data.kind === "code" ? data.code : null;
  const off = offerText(data.offer, data.off);
  // A code promotion applies itself at the table phone — no CTA needed on
  // the surfaces that show the code (matches the template's fillCopy():
  // `link.hidden = !cta.label || (row.kind === "code" && row.code)`).
  const showCta = hasType("ctas") && !(data.kind === "code" && code);
  const hero = heroImageOf(data.layout);
  const imageUrl = hero?.image_url || defaultImage || "";
  const objectPosition = BANNER_POSITION_COORDS[hero?.position ?? "center"];
  const objectFit = hero?.fit === "fit" ? "contain" : "cover";

  const showStill = data.look.still !== "none" && Boolean(imageUrl);

  if (surface === "ribbon") {
    return (
      <div className="promo-ribbon" data-still={data.look.still} data-tone={data.look.tone}>
        {showStill && (
          <div className="promo-still">
            <img src={imageUrl} alt="" style={{ objectFit, objectPosition }} />
          </div>
        )}
        <div className="promo-copy">
          {kicker && <p className="promo-kicker">{kicker}</p>}
          {title && <p className="promo-title">{title}</p>}
        </div>
        {code && <p className="promo-code">{code}</p>}
        {showCta && (
          <a className="promo-cta" href={preset.href} onClick={(e) => e.stopPropagation()}>
            {label}
          </a>
        )}
      </div>
    );
  }

  if (surface === "phone") {
    return (
      <div className="promo-phone" data-still={data.look.still} data-tone={data.look.tone}>
        {showStill && (
          <div className="promo-still">
            <img src={imageUrl} alt="" style={{ objectFit, objectPosition }} />
          </div>
        )}
        <div className="promo-copy">
          {kicker && <p className="promo-kicker">{kicker}</p>}
          {title && <p className="promo-title">{title}</p>}
          {dek && <p className="promo-dek">{dek}</p>}
          {off && <p className="promo-off">{off}</p>}
          {code && <p className="promo-code">{code}</p>}
        </div>
      </div>
    );
  }

  return (
    <article
      className="promo"
      data-kind={data.kind}
      data-still={data.look.still}
      data-tone={data.look.tone}
      data-align={data.look.align}
    >
      {showStill && (
        <div className="promo-still">
          <img src={imageUrl} alt="" style={{ objectFit, objectPosition }} />
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
        {showCta && (
          <a
            className="admin-book promo-cta"
            href={preset.href}
            onClick={(e) => e.stopPropagation()}
          >
            {label}
          </a>
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
