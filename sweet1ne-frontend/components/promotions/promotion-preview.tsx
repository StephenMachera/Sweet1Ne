"use client";

import {
  heroImageOf,
  imagesOf,
  CTA_PRESETS,
  type BannerPosition,
  type PromotionBlock,
  type PromotionBlockType,
  type PromotionCtaKind,
  type LogoBlock,
  type NoteBlock,
} from "@/lib/promotion-blocks";

const LOGO_SRC = "/images/brand/logo.png";

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
const LOGO_WIDTH: Record<LogoBlock["size"], string> = { s: "4.6rem", m: "7.2rem", l: "10.5rem" };

export type PromotionPreviewData = {
  kicker: string | null;
  title: string;
  dek: string | null;
  layout: PromotionBlock[];
  cta: PromotionCtaKind;
  cta_label: string | null;
  look: { still: string; align: string };
};

/** The message content shared by every surface — a homepage card, the
   ribbon, the table phone, a letter. Only the frame around it differs;
   what it says is exactly the same, same as the reference's single
   PROMO.paint() renderer reused across all look-frames. */
function PreviewBody({ data }: { data: PromotionPreviewData }) {
  const hasType = (t: PromotionBlockType) => data.layout.some((b) => b.type === t);
  const logo = data.layout.find((b): b is LogoBlock => b.type === "logo");
  const images = imagesOf(data.layout);
  const hero = heroImageOf(data.layout);
  const extras = images.filter((b) => b !== hero);
  const notes = data.layout.filter((b): b is NoteBlock => b.type === "note" && Boolean(b.text));
  const preset = CTA_PRESETS[data.cta];
  const label = data.cta_label || preset.label;

  return (
    <>
      {logo && <img src={LOGO_SRC} alt="Sweet1NE" style={{ width: LOGO_WIDTH[logo.size], marginBottom: "0.6rem" }} />}
      {hasType("kicker") && <p className="admin-kicker">{data.kicker || "Now"}</p>}
      {hasType("title") && <h2>{data.title || "Title sits here."}</h2>}
      {hasType("dek") && data.dek && <p className="admin-dek">{data.dek}</p>}
      {notes.map((n) => (
        <p key={n.id} className="admin-preview-note">
          {n.text}
        </p>
      ))}
      {extras.length > 0 && (
        <div className="admin-preview-extras">
          {extras.map((b) => (
            <img key={b.id} src={b.image_url} alt="" />
          ))}
        </div>
      )}
      {hasType("ctas") && (
        <div className="admin-preview-ctas">
          <a className="admin-book" href={preset.href}>
            {label}
          </a>
        </div>
      )}
    </>
  );
}

/** Full frame — hero photo behind the copy (or plain, if look.still is
   "none"). Reuses the events page's .admin-preview-next/-hero/-copy, which
   already do exactly this composition. */
export function PromotionPreview({ data }: { data: PromotionPreviewData }) {
  const hero = heroImageOf(data.layout);
  const showHero = data.look.still !== "none" && Boolean(hero);
  const align = data.look.align === "center" ? "center" : "left";

  if (!showHero) {
    return (
      <div className="admin-preview-copy" style={{ position: "static", maxWidth: "none", textAlign: align }}>
        <PreviewBody data={data} />
      </div>
    );
  }

  const objectPosition = BANNER_POSITION_COORDS[hero!.position ?? "center"];
  const objectFit = hero!.fit === "fit" ? "contain" : "cover";

  return (
    <div className="admin-preview-next">
      <div className="admin-preview-hero">
        <img src={hero!.image_url} alt="" style={{ objectFit, objectPosition }} />
      </div>
      <div className="admin-preview-copy" style={{ textAlign: align }}>
        <PreviewBody data={data} />
      </div>
    </div>
  );
}
