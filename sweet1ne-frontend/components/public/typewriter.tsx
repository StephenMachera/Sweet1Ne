"use client"

import { useState, useEffect } from "react";

const LINES = [
  "Scan the table. See the menu.",
  "One kitchen. Every branch.",
  "Orders, live, as they happen.",
];

const TYPE_SPEED = 45;
const HOLD_MS = 2000;
const CLEAR_SPEED = 20;

export function Typewriter() {
    const [lineIndex, setLineIndex] = useState(0);
    const [text, setText] = useState("");
    const [phase, setPhase] = useState<"typing" | "holding" | "clearing">("typing");
    const [reducedMotion, setReducedMotion] = useState(false);
    
    useEffect(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReducedMotion(query.matches);
    }, []);

    useEffect(() => {
        if (reducedMotion) return;

        const current = LINES[lineIndex];

        if (phase === "typing") {
        if (text.length < current.length) {
            const t = setTimeout(() => setText(current.slice(0, text.length + 1)), TYPE_SPEED);
            return () => clearTimeout(t);
        }
        const t = setTimeout(() => setPhase("holding"), 0);
        return () => clearTimeout(t);
        }

        if (phase === "holding") {
        const t = setTimeout(() => setPhase("clearing"), HOLD_MS);
        return () => clearTimeout(t);
        }

        if (text.length > 0) {
        const t = setTimeout(() => setText(text.slice(0, -1)), CLEAR_SPEED);
        return () => clearTimeout(t);
        }
        setLineIndex((i) => (i + 1) % LINES.length);
        setPhase("typing");
    }, [text, phase, lineIndex, reducedMotion]);

    if (reducedMotion) {
    return <p className="font-display text-3xl leading-snug text-gold">{LINES[0]}</p>;
  }

  return (
    <p className="font-display text-3xl leading-snug text-gold">
      {text}
      <span className="ml-1 inline-block h-8 w-[2px] animate-pulse bg-gold align-middle" />
    </p>
  );
}