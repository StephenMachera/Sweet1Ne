"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Uncovers an image with a clip-path wipe as it enters view.
 *
 * The image also starts slightly scaled up and settles back — so it feels
 * like it's being revealed rather than appearing, which is a better fit for
 * photography than a fade.
 */
export function MaskReveal({
  children,
  className = "",
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  direction?: "up" | "left";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { clipPath: "inset(0% 0% 0% 0%)" });
      gsap.set(el.firstElementChild, { scale: 1 });
      return;
    }

    const from =
      direction === "up"
        ? "inset(100% 0% 0% 0%)"   // uncovers upward
        : "inset(0% 100% 0% 0%)";  // uncovers left to right

    const timeline = gsap.timeline({
      scrollTrigger: { trigger: el, start: "top 82%", once: true },
    });

    timeline
      .fromTo(
        el,
        { clipPath: from },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.2, ease: "power3.inOut" }
      )
      .fromTo(
        el.firstElementChild,
        { scale: 1.15 },
        { scale: 1, duration: 1.4, ease: "power3.out" },
        // Overlaps the wipe rather than following it — the settle happens
        // while the image is still being uncovered.
        "<"
      );

    return () => {
      timeline.scrollTrigger?.kill();
      timeline.kill();
    };
  }, [direction]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ clipPath: "inset(100% 0% 0% 0%)" }}
    >
      {children}
    </div>
  );
}