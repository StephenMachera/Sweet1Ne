"use client";

import { EmojiField } from "@/components/ui/emoji-field";
import { mediaThumb, type MediaItem } from "@/lib/use-media-library";
import {
  addBlock,
  BANNER_POSITIONS,
  BLOCK_LABELS,
  heroImageOf,
  moveBlock,
  removeBlock,
  setHeroImage,
  updateBlock,
  type PromotionBlock,
} from "@/lib/promotion-blocks";
import { useRef, useState } from "react";

/** The one "Picture" a promotion carries — tapping a tile sets or replaces
   it directly rather than piling up new picture blocks, same as the
   reference build's hero-pick. A second, independent picture can still be
   added lower down as its own "+ Picture" piece. */
export function HeroPicker({
  media,
  layout,
  onChange,
}: {
  media: MediaItem[];
  layout: PromotionBlock[];
  onChange: (next: PromotionBlock[]) => void;
}) {
  const hero = heroImageOf(layout);

  return (
    <div className="admin-media-grid is-compact">
      {media.map((item) => {
        const thumb = mediaThumb(item);
        const selected = !!hero && hero.image_url === thumb;
        return (
          <button
            key={item.id}
            type="button"
            className={`${item.kind === "video" ? "is-film " : ""}${selected ? "is-on" : ""}`.trim()}
            aria-pressed={selected}
            onClick={() =>
              onChange(
                hero
                  ? updateBlock(layout, hero.id, {
                      image_url: thumb,
                    } as Partial<PromotionBlock>)
                  : addBlock(layout, "image", thumb),
              )
            }
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
              <button
                type="button"
                className="admin-edit"
                onClick={() => onChange(moveBlock(layout, i, -1))}
                disabled={i === 0}
              >
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
              <button
                type="button"
                className="admin-edit"
                onClick={() => onChange(removeBlock(layout, block.id))}
              >
                Remove
              </button>
            </div>
          </div>

          {block.type === "logo" && (
            <select
              value={block.size}
              onChange={(e) =>
                onChange(
                  updateBlock(layout, block.id, {
                    size: e.target.value,
                  } as Partial<PromotionBlock>),
                )
              }
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
                        onChange(
                          updateBlock(layout, block.id, {
                            image_url: selected ? "" : thumb,
                          } as Partial<PromotionBlock>),
                        )
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
              <div
                className="admin-anchor-grid"
                role="group"
                aria-label="Banner position"
              >
                {BANNER_POSITIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={label}
                    className={
                      (block.position ?? "center") === key ? "is-on" : undefined
                    }
                    onClick={() =>
                      onChange(
                        updateBlock(layout, block.id, {
                          position: key,
                        } as Partial<PromotionBlock>),
                      )
                    }
                  >
                    <span />
                  </button>
                ))}
              </div>
              <label>
                Fit
                <select
                  value={block.fit ?? "fill"}
                  onChange={(e) =>
                    onChange(
                      updateBlock(layout, block.id, {
                        fit: e.target.value as "fill" | "fit",
                      } as Partial<PromotionBlock>),
                    )
                  }
                >
                  <option value="fill">Fill the frame</option>
                  <option value="fit">Show all of it</option>
                </select>
              </label>
            </>
          )}

          {block.type === "note" && (
            <EmojiField
              value={block.text}
              placeholder="Limited seats tonight"
              onChange={(text) =>
                onChange(
                  updateBlock(layout, block.id, {
                    text,
                  } as Partial<PromotionBlock>),
                )
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
