"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Heading as HeadingIcon,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  MoveVertical,
  Plus,
  Quote,
  Tag,
  Trash2,
  Type,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export type Block =
  | { type: "eyebrow"; text: string; align: string }
  | { type: "heading"; text: string; size: "large" | "medium" | "small"; align: string }
  | { type: "paragraph"; text: string; align: string }
  | { type: "quote"; text: string }
  | { type: "image"; url: string; alt: string; full_width: boolean }
  | { type: "button"; label: string; url: string; align: string }
  | { type: "divider" }
  | { type: "spacer" };

const BLOCK_TYPES = [
  { type: "eyebrow", label: "Small label", icon: Tag },
  { type: "heading", label: "Heading", icon: HeadingIcon },
  { type: "paragraph", label: "Text", icon: Type },
  { type: "quote", label: "Quote", icon: Quote },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "spacer", label: "Space", icon: MoveVertical },
] as const;

function emptyBlock(type: Block["type"]): Block {
  switch (type) {
    case "eyebrow":
      return { type: "eyebrow", text: "", align: "left" };
    case "heading":
      return { type: "heading", text: "", size: "medium", align: "left" };
    case "paragraph":
      return { type: "paragraph", text: "", align: "left" };
    case "quote":
      return { type: "quote", text: "" };
    case "image":
      return { type: "image", url: "", alt: "", full_width: false };
    case "button":
      return { type: "button", label: "", url: "", align: "left" };
    case "divider":
      return { type: "divider" };
    case "spacer":
      return { type: "spacer" };
  }
}

/**
 * Blocks rather than a rich-text editor.
 *
 * The marketer controls what it says and what order it's in; the styling is
 * fixed in the renderer. That's what stops a Valentine's campaign arriving
 * in Comic Sans — and it means they never need a designer for a seasonal
 * send.
 */
export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}) {
  const [adding, setAdding] = useState(false);

  function update(index: number, patch: Partial<Block>) {
    onChange(
      blocks.map((block, i) => (i === index ? ({ ...block, ...patch } as Block) : block))
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;

    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function remove(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function add(type: Block["type"]) {
    onChange([...blocks, emptyBlock(type)]);
    setAdding(false);
  }

  return (
    <div className="space-y-3">
      {blocks.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink/15 px-6 py-12 text-center">
          <p className="text-sm text-ink-muted">
            Nothing here yet. Add a block to start building the email.
          </p>
        </div>
      )}

      {blocks.map((block, index) => (
        <BlockCard
          key={index}
          block={block}
          index={index}
          total={blocks.length}
          onUpdate={(patch) => update(index, patch)}
          onMove={(direction) => move(index, direction)}
          onRemove={() => remove(index)}
        />
      ))}

      {adding ? (
        <div className="rounded-xl border border-ink/8 bg-white p-4">
          <p className="mb-3 text-sm text-ink-muted">What kind of block?</p>
          <div className="flex flex-wrap gap-2">
            {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => add(type)}
                className="flex items-center gap-2 rounded-lg border border-ink/12 px-4 py-2.5 text-sm text-ink transition-colors hover:border-gold hover:bg-gold-soft"
              >
                <Icon size={15} strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAdding(false)}
            className="mt-3 text-xs text-ink-muted underline underline-offset-4"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink/15 py-4 text-sm text-ink-muted transition-colors hover:border-gold hover:text-ink"
        >
          <Plus size={16} />
          Add a block
        </button>
      )}
    </div>
  );
}

function BlockCard({
  block,
  index,
  total,
  onUpdate,
  onMove,
  onRemove,
}: {
  block: Block;
  index: number;
  total: number;
  onUpdate: (patch: Partial<Block>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const meta = BLOCK_TYPES.find((b) => b.type === block.type)!;
  const Icon = meta.icon;

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const {
        data: { session },
      } = await createClient().auth.getSession();

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/uploads/images?folder=campaigns`, {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error();

      const { url } = await res.json();
      onUpdate({ url } as Partial<Block>);
    } catch {
      // The field stays empty; the marketer can try again.
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink/8 bg-white shadow-[0_1px_3px_rgba(20,24,28,0.04)]">
      <div className="flex items-center gap-3 border-b border-ink/5 px-4 py-2.5">
        <Icon size={14} strokeWidth={1.5} className="text-ink-muted" />
        <span className="flex-1 text-xs uppercase tracking-[0.12em] text-ink-muted">
          {meta.label}
        </span>

        <button
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label="Move up"
          className="flex h-7 w-7 items-center justify-center rounded text-ink-muted hover:bg-ink/5 disabled:opacity-25"
        >
          <ChevronUp size={15} />
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label="Move down"
          className="flex h-7 w-7 items-center justify-center rounded text-ink-muted hover:bg-ink/5 disabled:opacity-25"
        >
          <ChevronDown size={15} />
        </button>
        <button
          onClick={onRemove}
          aria-label="Remove"
          className="flex h-7 w-7 items-center justify-center rounded text-ink-muted hover:bg-ember-soft hover:text-ember"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="space-y-3 p-4">
        {block.type === "eyebrow" && (
          <>
            <Input
              value={block.text}
              onChange={(e) => onUpdate({ text: e.target.value })}
              placeholder="e.g. This February only"
            />
            <p className="text-xs text-ink-muted">
              Small gold capitals — sits above a heading.
            </p>
            <AlignPicker
              value={block.align}
              onChange={(align) => onUpdate({ align } as Partial<Block>)}
            />
          </>
        )}

        {block.type === "heading" && (
          <>
            <Input
              value={block.text}
              onChange={(e) => onUpdate({ text: e.target.value })}
              placeholder="e.g. Table for two?"
            />
            <div className="flex flex-wrap gap-4">
              <Select
                label="Size"
                value={block.size}
                onChange={(size) => onUpdate({ size } as Partial<Block>)}
                options={[
                  { value: "large", label: "Large" },
                  { value: "medium", label: "Medium" },
                  { value: "small", label: "Small" },
                ]}
              />
              <AlignPicker
                value={block.align}
                onChange={(align) => onUpdate({ align } as Partial<Block>)}
              />
            </div>
          </>
        )}

        {block.type === "paragraph" && (
          <>
            <textarea
              rows={4}
              value={block.text}
              onChange={(e) => onUpdate({ text: e.target.value })}
              placeholder="Write your message. Leave a blank line between paragraphs."
              className="w-full resize-none rounded-lg border border-ink/15 px-3 py-2.5 text-sm"
            />
            <AlignPicker
              value={block.align}
              onChange={(align) => onUpdate({ align } as Partial<Block>)}
            />
          </>
        )}

        {block.type === "quote" && (
          <>
            <textarea
              rows={2}
              value={block.text}
              onChange={(e) => onUpdate({ text: e.target.value })}
              placeholder="One line worth pulling out."
              className="w-full resize-none rounded-lg border border-ink/15 px-3 py-2.5 text-sm"
            />
            <p className="text-xs text-ink-muted">
              Set large in serif, with a gold rule beside it.
            </p>
          </>
        )}

        {block.type === "image" && (
          <>
            {block.url ? (
              <div className="relative overflow-hidden rounded-lg border border-ink/10">
                <img src={block.url} alt="" className="h-40 w-full object-cover" />
                <button
                  onClick={() => onUpdate({ url: "" } as Partial<Block>)}
                  className="absolute right-2 top-2 rounded bg-black/60 px-2.5 py-1 text-xs text-white"
                >
                  Replace
                </button>
              </div>
            ) : (
              <label
                htmlFor={`img-${index}`}
                className="flex h-28 cursor-pointer items-center justify-center rounded-lg border border-dashed border-ink/15 text-sm text-ink-muted"
              >
                {uploading ? "Uploading…" : "Click to upload an image"}
              </label>
            )}
            <input
              id={`img-${index}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadImage}
              className="hidden"
            />

            <Input
              value={block.alt}
              onChange={(e) => onUpdate({ alt: e.target.value })}
              placeholder="Describe the image (for screen readers)"
            />

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={block.full_width}
                onChange={(e) => onUpdate({ full_width: e.target.checked } as Partial<Block>)}
                className="h-4 w-4 accent-[#d4a853]"
              />
              Full width — no margin either side
            </label>
          </>
        )}

        {block.type === "button" && (
          <>
            <Input
              value={block.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="e.g. Book a table"
            />
            <Input
              value={block.url}
              onChange={(e) => onUpdate({ url: e.target.value })}
              placeholder="https://sweet1ne.com/reservations"
            />
            <AlignPicker
              value={block.align}
              onChange={(align) => onUpdate({ align } as Partial<Block>)}
            />
          </>
        )}

        {block.type === "divider" && (
          <p className="text-sm text-ink-muted">A thin line. Nothing to set.</p>
        )}

        {block.type === "spacer" && (
          <p className="text-sm text-ink-muted">A gap. Nothing to set.</p>
        )}
      </div>
    </div>
  );
}

function AlignPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">Align</Label>
      <div className="flex gap-1">
        {["left", "center", "right"].map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`rounded px-3 py-1.5 text-xs capitalize transition-colors ${
              value === option
                ? "bg-ink text-paper"
                : "border border-ink/12 text-ink-muted hover:text-ink"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-ink/15 bg-white px-3 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}