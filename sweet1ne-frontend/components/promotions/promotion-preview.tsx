"use client";

import {
  heroImageOf,
  CTA_PRESETS,
  type BannerPosition,
  type PromotionBlock,
  type PromotionBlockType,
  type PromotionCtaKind,
  type NoteBlock,
} from "@/lib/promotion-blocks";

const BANNER_POSITION_COORDS: Record<BannerPosition, string> = {
  "top-left": "0% 0%",
  top: "50% 0%",
  "top-right": "100% 0%",
  left: "0% 50%",
  center: "50% 50%",
  right: "100% 50%",
  "bottom-left": "0% 100%",
  bottom: "50% 100%",
  "bottom-right": "100% 100%",
};

export type PromotionPreviewData = {
  kicker: string | null;
  title: string;
  dek: string | null;
  layout: PromotionBlock[];
  cta: PromotionCtaKind;
  cta_label: string | null;
  look: { still: string; tone: string; align: string };
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
}: {
  data: PromotionPreviewData;
  surface: "enter" | "ribbon" | "phone";
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
  const showStill = data.look.still !== "none" && Boolean(hero);
  const objectPosition = hero
    ? BANNER_POSITION_COORDS[hero.position ?? "center"]
    : undefined;
  const objectFit = hero?.fit === "fit" ? "contain" : "cover";

  return (
    <article
      className="admin-promo-card"
      data-still={showStill ? data.look.still : "none"}
      data-tone={data.look.tone}
      data-align={data.look.align}
    >
      <div className="admin-promo-card-still">
        {showStill && hero && (
          <img
            src={hero.image_url}
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
