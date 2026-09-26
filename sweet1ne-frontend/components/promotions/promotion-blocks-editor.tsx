"use client";

import { EmojiField } from "@/components/ui/emoji-field";
import { mediaThumb, type MediaItem } from "@/lib/use-media-library";
import {
  addBlock,
  BLOCK_LABELS,
  moveBlock,
  removeBlock,
  setHeroImage,
  updateBlock,
  type PromotionBlock,
} from "@/lib/promotion-blocks";
import { useRef, useState } from "react";

/** A quick-add picture strip, right under the add-blocks bar — tapping a
   tile immediately adds a new picture block filled with that image. Mirrors
   the event composer's QuickGallery (components/events/event-form.tsx). */
export function QuickGallery({
  media,
  layout,
  onChange,
}: {
  media: MediaItem[];
  layout: PromotionBlock[];
  onChange: (next: PromotionBlock[]) => void;
}) {
  const slots = Math.max(25, media.length);

  return (
    <div className="admin-media-grid is-quick">
      {Array.from({ length: slots }, (_, i) => {
        const item = media[i];
        if (!item) {
          return (
            <button key={`empty-${i}`} type="button" className="is-none" disabled>
              <span>No image</span>
            </button>
          );
        }
        const thumb = mediaThumb(item);
        return (
          <button
            key={item.id}
            type="button"
            className={item.kind === "video" ? "is-film" : undefined}
            onClick={() => onChange(addBlock(layout, "image", thumb))}
          >
            {thumb && <img src={thumb} alt="" />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PromotionLayoutEditor({
  media,
  layout,
  onChange,
}: {
  media: MediaItem[];
  layout: PromotionBlock[];
  onChange: (next: PromotionBlock[]) => void;
}) {
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleDrop(targetIndex: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from === null || from === targetIndex) return;
    const next = layout.slice();
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
  }

  return (
    <div>
      {layout.map((block, i) => (
        <div
          key={block.id}
          className={`admin-layout-row${overIndex === i ? " is-drop-target" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragIndex.current !== null) setOverIndex(i);
          }}
          onDragLeave={() => setOverIndex((cur) => (cur === i ? null : cur))}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(i);
          }}
        >
          <div className="admin-block-head">
            <div className="admin-row-acts">
              <button
                type="button"
                className="admin-drag-handle"
                draggable
                onDragStart={(e) => {
                  dragIndex.current = i;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  dragIndex.current = null;
                  setOverIndex(null);
                }}
                aria-label={`Drag to reorder ${BLOCK_LABELS[block.type]}`}
              >
                ⠿
              </button>
              <p>{BLOCK_LABELS[block.type]}</p>
            </div>
            <div className="admin-row-acts">
              <button type="button" className="admin-edit" onClick={() => onChange(moveBlock(layout, i, -1))} disabled={i === 0}>
                Move up
              </button>
              <button
                type="button"
                className="admin-edit"
                onClick={() => onChange(moveBlock(layout, i, 1))}
                disabled={i === layout.length - 1}
              >
                Move down
              </button>
              <button type="button" className="admin-edit" onClick={() => onChange(removeBlock(layout, block.id))}>
                Remove
              </button>
            </div>
          </div>

          {block.type === "logo" && (
            <select
              value={block.size}
              onChange={(e) => onChange(updateBlock(layout, block.id, { size: e.target.value } as Partial<PromotionBlock>))}
            >
              <option value="s">Small</option>
              <option value="m">Medium</option>
              <option value="l">Large</option>
            </select>
          )}

          {block.type === "image" && (
            <>
              <div className="admin-media-grid">
                {media.length === 0 && (
                  <button type="button" className="is-none" disabled>
                    <span>No media yet</span>
                  </button>
                )}
                {media.map((item) => {
                  const thumb = mediaThumb(item);
                  const selected = block.image_url === thumb;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`${item.kind === "video" ? "is-film " : ""}${selected ? "is-on" : ""}`.trim()}
                      aria-pressed={selected}
                      onClick={() =>
                        onChange(updateBlock(layout, block.id, { image_url: selected ? "" : thumb } as Partial<PromotionBlock>))
                      }
                    >
                      {thumb && <img src={thumb} alt="" />}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={block.hero}
                  onChange={() => onChange(setHeroImage(layout, block.id))}
                />
                Use as the hero picture
              </label>
            </>
          )}

          {block.type === "note" && (
            <EmojiField
              value={block.text}
              placeholder="Limited seats tonight"
              onChange={(text) => onChange(updateBlock(layout, block.id, { text } as Partial<PromotionBlock>))}
            />
          )}
        </div>
      ))}
    </div>
  );
}
