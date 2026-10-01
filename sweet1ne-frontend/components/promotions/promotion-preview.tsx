"use client";

import {
  heroImageOf,
  CTA_PRESETS,
  BANNER_POSITION_COORDS,
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

function offerText(offer: string, off: number | null): string {
  if (offer === "percent" && off) return `${off}% off the basket`;
  if (offer === "pounds" && off) return `£${off.toFixed(2)} off the basket`;
  return "";
}

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

  if (surface === "ribbon") {
    return (
      <div className="admin-promo-ribbon">
        {kicker && <p className="admin-promo-kicker">{kicker}</p>}
        {title && <p className="admin-promo-title">{title}</p>}
        {code && <p className="admin-promo-code">{code}</p>}
        {hasType("ctas") && (
          <a className="admin-promo-cta" href={preset.href}>
            {label}
          </a>
        )}
      </div>
    );
  }

  if (surface === "phone") {
    return (
      <div className="admin-promo-phone-card">
        <div>
          {kicker && <p className="admin-promo-kicker">{kicker}</p>}
          {title && <p className="admin-promo-title">{title}</p>}
          {dek && <p className="admin-promo-dek">{dek}</p>}
          {off && <p className="admin-promo-off">{off}</p>}
        </div>
        {code && <p className="admin-promo-code">{code}</p>}
      </div>
    );
  }

  const hero = heroImageOf(data.layout);
  const imageUrl = hero?.image_url || defaultImage || "";
  const showStill = data.look.still !== "none" && Boolean(imageUrl);
  const objectPosition = BANNER_POSITION_COORDS[hero?.position ?? "center"];
  const objectFit = hero?.fit === "fit" ? "contain" : "cover";
  // Independent of the hero still above — a full-bleed backdrop behind the
  // whole card, dimmed so the words stay readable over any photo. Falls
  // back to the same tenant default the hero still uses, but that's just a
  // shared fallback source, not a shared value: picking one doesn't set
  // the other.
  const backgroundUrl = data.look.background_image || defaultImage || "";

  return (
    <article
      className="admin-promo-card"
      data-still={showStill ? data.look.still : "none"}
      data-tone={data.look.tone}
      data-align={data.look.align}
    >
      {backgroundUrl && (
        <div className="admin-promo-bg" aria-hidden>
          <img src={backgroundUrl} alt="" />
        </div>
      )}
      <div className="admin-promo-card-still">
        {showStill && (
          <img
            src={imageUrl}
            alt=""
            style={{ objectFit, objectPosition }}
          />
        )}
      </div>
      <div className="admin-promo-card-copy">
        {kicker && <p className="admin-promo-kicker">{kicker}</p>}
        {title && <p className="admin-promo-title">{title}</p>}
        {dek && <p className="admin-promo-dek">{dek}</p>}
        {notes.map((n) => (
          <p key={n.id} className="admin-promo-note">
            {n.text}
          </p>
        ))}
        {code && <p className="admin-promo-code">{code}</p>}
        {off && <p className="admin-promo-off">{off}</p>}
        {hasType("ctas") && (
          <a className="admin-book admin-promo-cta" href={preset.href}>
            {label}
          </a>
        )}
      </div>
    </article>
  );
}
