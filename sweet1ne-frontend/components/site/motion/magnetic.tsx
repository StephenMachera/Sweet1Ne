"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * Pulls an element gently toward the cursor.
 *
 * Only on pointer devices — a magnetic effect on touch does nothing except
 * cost you a listener. Reserved for the primary gold buttons; on everything
 * it would be noise.
 */
export function Magnetic({
  children,
  strength = 0.35,
}: {
  children: React.ReactNode;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No hover, or reduced motion — do nothing at all.
    if (
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const onMove = (e: MouseEvent) => {
      const box = el.getBoundingClientRect();
      // Distance from the element's centre, scaled down so it leans rather
      // than lunges.
      const x = (e.clientX - (box.left + box.width / 2)) * strength;
      const y = (e.clientY - (box.top + box.height / 2)) * strength;

      gsap.to(el, { x, y, duration: 0.6, ease: "power3.out" });
    };

    const onLeave = () => {
      // elastic on the way back — it settles rather than snapping.
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" });
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      gsap.killTweensOf(el);
    };
  }, [strength]);

  return (
    <div ref={ref} className="inline-block">
      {children}
    </div>
  );
}