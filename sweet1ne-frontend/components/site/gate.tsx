"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

const TIMEOUT_MS = 1600;

/**
 * A short hold before the page opens.
 *
 * Translucent rather than solid — the films are visible behind it through
 * the blur, so it reads as a curtain rather than a loading screen. Lifts on
 * a click, a keypress, or after 1.6 seconds.
 */
export function Gate({ onOpen }: { onOpen: () => void }) {
  const [opened, setOpened] = useState(false);
  const [gone, setGone] = useState(false);
  const openingRef = useRef(false);

  const open = useCallback(() => {
    if (openingRef.current) return;

    openingRef.current = true;
    setOpened(true);
    onOpen();
    // Removed from the tree after the fade, so it can't trap focus or
    // intercept clicks.
    setTimeout(() => setGone(true), 480);
  }, [onOpen]);

  useEffect(() => {
    if (opened) return;

    // Reduced motion skips it entirely — the gate is a flourish, and
    // someone who's asked for less of that shouldn't be made to wait.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      open();
      setGone(true);
      return;
    }

    const timer = setTimeout(open, TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (opened) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        open();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opened, open]);

  if (gone) return null;

  return (
    <div
      onClick={open}
      role="button"
      tabIndex={0}
      aria-label="Enter"
      aria-hidden={opened}
      className="fixed inset-0 z-[200] grid cursor-pointer place-items-center backdrop-blur-[8px] transition-opacity duration-[450ms] ease-out"
      style={{
        background: "rgba(5,5,5,.72)",
        opacity: opened ? 0 : 1,
        pointerEvents: opened ? "none" : "auto",
      }}
    >
      <div className="max-w-[min(90vw,28rem)] px-5 text-center">
        <div className="gate-logo mx-auto w-[min(58vw,196px)] sm:w-[min(52vw,236px)]">
          <Image
            src="/images/brand/logo.png"
            alt="Sweet1NE"
            width={236}
            height={236}
            priority
            className="h-auto w-full"
            style={{ filter: "drop-shadow(0 8px 28px rgba(0,0,0,.55))" }}
          />
        </div>

        {/* A gold rule that arrives a beat after the logo — the whole
            animation is half a second, so the stagger is most of what makes
            it feel composed. */}
        <hr className="gate-rule mx-auto mt-[1.05rem] h-px w-[2.2rem] border-0 bg-[var(--gold)]" />
      </div>
    </div>
  );
}