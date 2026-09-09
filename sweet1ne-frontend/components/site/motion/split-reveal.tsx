"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Reveals a headline word by word as it enters the viewport.
 *
 * Each word sits in a clipping wrapper and slides up from below it — so the
 * type appears to rise out of the page rather than fade in. Suits Bodoni,
 * where the letterforms are the point.
 */
export function SplitReveal({
  children,
  className = "",
  as: Tag = "h2",
  delay = 0,
}: {
  children: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el.querySelectorAll(".split-word"), { y: 0, opacity: 1 });
      return;
    }

    const words = el.querySelectorAll(".split-word");

    const animation = gsap.fromTo(
      words,
      { yPercent: 135, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.9,
        delay,
        ease: "power3.out",
        // Words arrive in sequence rather than together — 60ms apart reads
        // as deliberate without feeling slow.
        stagger: 0.06,
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          once: true,
        },
      }
    );

    return () => {
      animation.scrollTrigger?.kill();
      animation.kill();
    };
  }, [delay]);

  // Split on spaces, keeping line breaks intact.
  const lines = children.split("\n");

  return (
    <Tag ref={ref as never} className={className}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="block">
          {line.split(" ").map((word, i) => (
            <span
              key={i}
              // overflow-hidden on the wrapper is what makes the word appear
              // to rise out of nothing rather than sliding in from below.
              //
              // The padding/negative-margin pair widens the *clip* box below
              // the baseline without moving anything: headlines here run at
              // leading below 1, so the line box is shorter than Bodoni's
              // descenders are deep, and the tails of p, y and g were being
              // sliced off. Margin box height is unchanged, so line spacing
              // stays exactly as the caller set it.
              className="inline-block overflow-hidden align-bottom pb-[0.22em] -mb-[0.22em]"
            >
              <span className="split-word inline-block" style={{ opacity: 0 }}>
                {word}
                {i < line.split(" ").length - 1 ? "\u00A0" : ""}
              </span>
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}