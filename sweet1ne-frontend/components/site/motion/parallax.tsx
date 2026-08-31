"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Moves an element slower than the page as it scrolls.
 *
 * Kept deliberately subtle — 12% by default. Heavy parallax on food
 * photography looks like a template; a hint of it just makes the image feel
 * like it has depth.
 */
export function Parallax({
  children,
  className = "",
  amount = 0.12,
}: {
  children: React.ReactNode;
  className?: string;
  amount?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const animation = gsap.fromTo(
      el,
      { yPercent: -amount * 100 },
      {
        yPercent: amount * 100,
        ease: "none",
        scrollTrigger: {
          trigger: el.parentElement,
          start: "top bottom",
          end: "bottom top",
          // scrub ties the animation to scroll position rather than time —
          // 0.5 adds a slight lag that makes it feel weighted.
          scrub: 0.5,
        },
      }
    );

    return () => {
      animation.scrollTrigger?.kill();
      animation.kill();
    };
  }, [amount]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}