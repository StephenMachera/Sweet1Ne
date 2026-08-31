"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth scrolling, synced to GSAP.
 *
 * Lenis intercepts the wheel and animates scroll position itself, which is
 * the single biggest "this feels expensive" change on a site like this. The
 * sync matters: without it, ScrollTrigger reads the browser's scroll while
 * Lenis is animating its own, and every scroll-driven animation lags.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Anyone who's asked for less motion gets the browser's native scroll.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      // Exponential ease-out — fast at first, settling gently. The default
      // feels floaty; this reads as weighted.
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Touch devices already have good native momentum, and overriding it
      // fights the user's expectations.
      syncTouch: false,
    });

    lenis.on("scroll", ScrollTrigger.update);

    // Drive Lenis from GSAP's ticker rather than its own requestAnimationFrame
    // loop, so both run on the same frame.
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}