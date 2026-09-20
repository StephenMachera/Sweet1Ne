/**
 * The event composer's block model — mirrors Event.layout / Event.ctas on
 * the backend (app/models/event.py), which store these as JSONB and don't
 * enforce their shape beyond "a list of dicts". Typed strictly here on the
 * frontend for the editor's sake; the backend stays permissive so new block
 * types don't need a migration to add.
 *
 * kicker/meta/title/dek/ctas are pure show/hide toggles for the matching
 * plain fields on the event (tagline, starts_at/ends_at/branch, title,
 * description, ctas) — they carry no data of their own. logo/image/note
 * carry their own content and can repeat (image, note) or not (logo).
 */

export type EventBlockType = "logo" | "kicker" | "meta" | "title" | "dek" | "image" | "note" | "ctas";

export type LogoBlock = { id: string; type: "logo"; size: "s" | "m" | "l" };
export type KickerBlock = { id: string; type: "kicker" };
export type MetaBlock = { id: string; type: "meta" };
export type TitleBlock = { id: string; type: "title" };
export type DekBlock = { id: string; type: "dek" };
export type ImageBlock = { id: string; type: "image"; image_url: string; hero: boolean };
export type NoteBlock = { id: string; type: "note"; text: string };
export type CtasBlock = { id: string; type: "ctas" };

export type EventBlock =
  | LogoBlock
  | KickerBlock
  | MetaBlock
  | TitleBlock
  | DekBlock
  | ImageBlock
  | NoteBlock
  | CtasBlock;

export type EventCtaKind = "book" | "menu" | "order" | "url";
export type EventCta = { kind: EventCtaKind; label: string; href: string };

// Real routes on the guest site — not invented placeholders.
export const CTA_PRESETS: Record<Exclude<EventCtaKind, "url">, { label: string; href: string }> = {
  book: { label: "Book", href: "/reservations" },
  menu: { label: "Menu", href: "/menu" },
  order: { label: "Order", href: "/order" },
};

export const BLOCK_LABELS: Record<EventBlockType, string> = {
  logo: "Logo",
  kicker: "Kicker",
  meta: "Date",
  title: "Title",
  dek: "Copy",
  image: "Picture",
  note: "Note",
  ctas: "Buttons",
};

// Only one of these makes sense at a time; image and note can repeat.
const SINGLETON: EventBlockType[] = ["logo", "kicker", "meta", "title", "dek", "ctas"];

let seq = 0;
function newBlockId() {
  seq += 1;
  return `b${Date.now().toString(36)}${seq}`;
}

export function defaultEventLayout(): EventBlock[] {
  return [
    { id: newBlockId(), type: "kicker" },
    { id: newBlockId(), type: "meta" },
    { id: newBlockId(), type: "title" },
    { id: newBlockId(), type: "dek" },
    { id: newBlockId(), type: "ctas" },
  ];
}

export function hasBlock(layout: EventBlock[], type: EventBlockType): boolean {
  return layout.some((b) => b.type === type);
}

export function addBlock(layout: EventBlock[], type: EventBlockType, imageUrl?: string): EventBlock[] {
  if (SINGLETON.includes(type) && hasBlock(layout, type)) return layout;

  const id = newBlockId();
  if (type === "logo") return [...layout, { id, type: "logo", size: "m" }];
  if (type === "image") {
    return [...layout, { id, type: "image", image_url: imageUrl ?? "", hero: !hasBlock(layout, "image") }];
  }
  if (type === "note") return [...layout, { id, type: "note", text: "" }];
  return [...layout, { id, type } as EventBlock];
}

export function moveBlock(layout: EventBlock[], index: number, dir: -1 | 1): EventBlock[] {
  const to = index + dir;
  if (to < 0 || to >= layout.length) return layout;
  const next = layout.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export function removeBlock(layout: EventBlock[], id: string): EventBlock[] {
  return layout.filter((b) => b.id !== id);
}

export function updateBlock(layout: EventBlock[], id: string, patch: Partial<EventBlock>): EventBlock[] {
  return layout.map((b) => (b.id === id ? ({ ...b, ...patch } as EventBlock) : b));
}

/** Only one image block can be the hero; picking one un-sets the rest. */
export function setHeroImage(layout: EventBlock[], id: string): EventBlock[] {
  return layout.map((b) => (b.type === "image" ? { ...b, hero: b.id === id } : b));
}

export function imagesOf(layout: EventBlock[]): ImageBlock[] {
  return layout.filter((b): b is ImageBlock => b.type === "image" && Boolean(b.image_url));
}

export function heroImageOf(layout: EventBlock[]): ImageBlock | undefined {
  const images = imagesOf(layout);
  return images.find((b) => b.hero) ?? images[0];
}

/** datetime-local wants "YYYY-MM-DDTHH:mm", not a full ISO string. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
