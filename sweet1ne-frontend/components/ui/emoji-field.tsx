"use client";

import { useRef, useState } from "react";

export const COMPOSER_EMOJI = [
  "🎉", "🥂", "🍸", "🍷", "🍽️", "🎶", "🎷", "🎸",
  "🕯️", "✨", "🔥", "❤️", "🎄", "🎃", "🎆", "📍",
  "📅", "⭐", "🎁", "💫",
];

/** A text field (input or textarea) plus a tap-to-insert emoji bar under
   it — inserts at the cursor and puts it back afterwards, rather than
   always appending. Shared by the event composer (kicker, title, copy,
   notes) and anywhere else in the admin console that wants emoji in a
   free-text field, e.g. a table's region/area name. */
export function EmojiField({
  value,
  onChange,
  placeholder,
  required,
  multiline,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  // Only shown once the field itself is focused — the bar used to sit under
  // every field all the time, cluttering the form before anyone had even
  // clicked in. onMouseDown below keeps focus on the field while tapping an
  // emoji, so this never disappears mid-click.
  const [focused, setFocused] = useState(false);

  function insertEmoji(emoji: string) {
    const el = ref.current;
    if (!el) {
      onChange(value + emoji);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + emoji + value.slice(end));
    requestAnimationFrame(() => {
      const pos = start + emoji.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <>
      {multiline ? (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      ) : (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          required={required}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      )}
      {!disabled && focused && (
        <div className="admin-emoji-bar">
          {COMPOSER_EMOJI.map((emoji) => (
            <button key={emoji} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertEmoji(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
