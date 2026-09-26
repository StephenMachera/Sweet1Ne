/**
 * The promotion composer's block model — mirrors the event composer
 * (components/events/event-blocks.ts) but for Promotion.layout (JSONB,
 * app/models/promotion.py). kicker/title/dek/ctas are show/hide toggles for
 * the matching plain fields on the promotion (kicker, title, dek, cta/
 * cta_label) — they carry no data of their own. logo/image/note carry their
 * own content and can repeat (image, note) or not (logo).
 */

export type PromotionBlockType = "logo" | "kicker" | "title" | "dek" | "image" | "note" | "ctas";

export type LogoBlock = { id: string; type: "logo"; size: "s" | "m" | "l" };
export type KickerBlock = { id: string; type: "kicker" };
export type TitleBlock = { id: string; type: "title" };
export type DekBlock = { id: string; type: "dek" };
// A 9-point anchor grid (like a photo editor's crop-focus picker) — covers
// both axes, not just vertical.
export type BannerPosition =
  | "top-left" | "top" | "top-right"
  | "left" | "center" | "right"
  | "bottom-left" | "bottom" | "bottom-right";

export const BANNER_POSITIONS: { key: BannerPosition; label: string }[] = [
  { key: "top-left", label: "Top left" },
  { key: "top", label: "Top" },
  { key: "top-right", label: "Top right" },
  { key: "left", label: "Left" },
  { key: "center", label: "Centre" },
  { key: "right", label: "Right" },
  { key: "bottom-left", label: "Bottom left" },
  { key: "bottom", label: "Bottom" },
  { key: "bottom-right", label: "Bottom right" },
];

export type ImageBlock = {
  id: string;
  type: "image";
  image_url: string;
  hero: boolean;
  // Where the banner's focal point sits when it's cropped to fit the frame.
  position: BannerPosition;
  // "fill" crops the frame edge-to-edge (may crop the image); "fit" shows
  // the whole image, letterboxed if its shape doesn't match the frame.
  fit: "fill" | "fit";
};
export type NoteBlock = { id: string; type: "note"; text: string };
export type CtasBlock = { id: string; type: "ctas" };

export type PromotionBlock =
  | LogoBlock
  | KickerBlock
  | TitleBlock
  | DekBlock
  | ImageBlock
  | NoteBlock
  | CtasBlock;

export type PromotionCtaKind = "book" | "find" | "menu" | "events" | "contact" | "order" | "join";

// Real routes on the guest site — not invented placeholders. "join" points
// at /events, which already carries the real newsletter sign-up form.
export const CTA_PRESETS: Record<PromotionCtaKind, { label: string; href: string }> = {
  book: { label: "Book a table", href: "/reservations" },
  find: { label: "Find Us", href: "/locations" },
  menu: { label: "The menu", href: "/menu" },
  events: { label: "Events", href: "/events" },
  contact: { label: "Write to us", href: "/contact" },
  order: { label: "Order", href: "/order" },
  join: { label: "Join the list", href: "/events" },
};

export const BLOCK_LABELS: Record<PromotionBlockType, string> = {
  logo: "Logo",
  kicker: "Kicker",
  title: "Title",
  dek: "Copy",
  image: "Picture",
  note: "Note",
  ctas: "Buttons",
};

const SINGLETON: PromotionBlockType[] = ["logo", "kicker", "title", "dek", "ctas"];

let seq = 0;
function newBlockId() {
  seq += 1;
  return `b${Date.now().toString(36)}${seq}`;
}

export function defaultPromotionLayout(): PromotionBlock[] {
  return [
    { id: newBlockId(), type: "kicker" },
    { id: newBlockId(), type: "title" },
    { id: newBlockId(), type: "dek" },
    { id: newBlockId(), type: "ctas" },
  ];
}

export function hasBlock(layout: PromotionBlock[], type: PromotionBlockType): boolean {
  return layout.some((b) => b.type === type);
}

export function addBlock(layout: PromotionBlock[], type: PromotionBlockType, imageUrl?: string): PromotionBlock[] {
  if (SINGLETON.includes(type) && hasBlock(layout, type)) return layout;

  const id = newBlockId();
  if (type === "logo") return [...layout, { id, type: "logo", size: "m" }];
  if (type === "image") {
    return [
      ...layout,
      { id, type: "image", image_url: imageUrl ?? "", hero: !hasBlock(layout, "image"), position: "center", fit: "fill" },
    ];
  }
  if (type === "note") return [...layout, { id, type: "note", text: "" }];
  return [...layout, { id, type } as PromotionBlock];
}

export function moveBlock(layout: PromotionBlock[], index: number, dir: -1 | 1): PromotionBlock[] {
  const to = index + dir;
  if (to < 0 || to >= layout.length) return layout;
  const next = layout.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export function removeBlock(layout: PromotionBlock[], id: string): PromotionBlock[] {
  return layout.filter((b) => b.id !== id);
}

export function updateBlock(layout: PromotionBlock[], id: string, patch: Partial<PromotionBlock>): PromotionBlock[] {
  return layout.map((b) => (b.id === id ? ({ ...b, ...patch } as PromotionBlock) : b));
}

export function setHeroImage(layout: PromotionBlock[], id: string): PromotionBlock[] {
  return layout.map((b) => (b.type === "image" ? { ...b, hero: b.id === id } : b));
}

export function imagesOf(layout: PromotionBlock[]): ImageBlock[] {
  return layout.filter((b): b is ImageBlock => b.type === "image" && Boolean(b.image_url));
}

export function heroImageOf(layout: PromotionBlock[]): ImageBlock | undefined {
  const images = imagesOf(layout);
  return images.find((b) => b.hero) ?? images[0];
}
