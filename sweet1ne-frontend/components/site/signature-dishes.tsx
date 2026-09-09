"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * The pinned section below MUST clean up in a layout effect, not useEffect.
 *
 * ScrollTrigger's `pin` moves the pinned element into a `.pin-spacer` div it
 * creates, so the element's real parent is no longer the one React recorded.
 * React removes DOM nodes in the mutation phase but runs useEffect cleanups
 * in the later passive phase — so on navigation it would try to remove a
 * still-pinned node from the wrong parent and throw "removeChild: The node
 * to be removed is not a child of this node", taking the whole page down.
 * A layout effect's cleanup runs during the mutation phase instead, so
 * ctx.revert() unwraps the pin-spacer before React touches the node.
 *
 * useLayoutEffect warns when it runs on the server, and client components
 * are still server-rendered, hence the isomorphic fallback.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** The photographs carry this section on their own — `alt` is the only text. */
export type Dish = {
  id: string;
  alt: string;
  image: string;
};

export function SignatureDishes({ dishes }: { dishes: Dish[] }) {
  return (
    <>
      <DesktopDishes dishes={dishes} />
      <MobileDishes dishes={dishes} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop — pinned, one photograph at a time                          */
/* ------------------------------------------------------------------ */

function DesktopDishes({ dishes }: { dishes: Dish[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isDesktop || reduced) return;

    const ctx = gsap.context(() => {
      const layers = gsap.utils.toArray<HTMLElement>(".dish-layer");

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${dishes.length * 100}%`,
          pin: true,
          scrub: 1,
          onUpdate: (self) => {
            setActive(
              Math.min(dishes.length - 1, Math.floor(self.progress * dishes.length))
            );
          },
        },
      });

      layers.forEach((layer, i) => {
        const image = layer.querySelector(".dish-image");

        timeline
          .fromTo(layer, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" }, i)
          .fromTo(
            image,
            { filter: "blur(24px)", scale: 1.2 },
            { filter: "blur(0px)", scale: 1, duration: 0.6, ease: "power2.out" },
            i
          );

        if (i < layers.length - 1) {
          timeline
            .to(image, { filter: "blur(16px)", scale: 0.94, duration: 0.4 }, i + 0.65)
            .to(layer, { opacity: 0, duration: 0.4 }, i + 0.65);
        }
      });
    }, section);

    return () => ctx.revert();
  }, [dishes.length]);

  return (
    <section ref={sectionRef} className="relative hidden h-screen overflow-hidden lg:block">
      {dishes.map((dish, i) => (
        <div
          key={dish.id}
          className="dish-layer absolute inset-0"
          style={{ opacity: i === 0 ? 1 : 0 }}
        >
          <div className="dish-image absolute inset-0">
            <Image
              src={dish.image}
              alt={dish.alt}
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
          </div>

          {/* Only as much scrim as the progress rule and link below need —
              with no copy to carry, the photograph should stay lit. */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0e0e0e] to-transparent" />
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-10 z-10">
        <div className="mx-auto flex max-w-[1440px] items-center gap-6 px-12">
          <div className="flex flex-1 gap-1.5">
            {dishes.map((dish, i) => (
              <span
                key={dish.id}
                className={`h-px flex-1 transition-colors duration-500 ${
                  i === active ? "bg-[var(--gold)]" : "bg-white/12"
                }`}
              />
            ))}
          </div>
          <Link
            href="/menu"
            className="shrink-0 border-b border-[var(--ivory)]/30 pb-1 text-sm text-[var(--ivory-dim)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            Full menu
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile — an unattended carousel                                     */
/* ------------------------------------------------------------------ */

/** How long each photograph holds before the rail moves on. */
const ADVANCE_MS = 4000;

/** A swipe pauses the automatic advance for this long, so the two never
 *  fight over the same rail. */
const RESUME_AFTER_MS = 8000;

function MobileDishes({ dishes }: { dishes: Dish[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // A timestamp rather than a boolean: every interaction just pushes the
  // resume time further out, so there's no paused/unpaused state to leak.
  const pausedUntil = useRef(0);

  /** Index of the slide nearest the centre, measured from the rail itself so
   *  a swipe and the timer can never disagree about where we are. */
  const nearestIndex = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return 0;

    const centre = rail.scrollLeft + rail.clientWidth / 2;
    let nearest = 0;
    let smallest = Infinity;

    rail.querySelectorAll<HTMLElement>("[data-slide]").forEach((el) => {
      const slideCentre = el.offsetLeft + el.offsetWidth / 2;
      const distance = Math.abs(slideCentre - centre);
      if (distance < smallest) {
        smallest = distance;
        nearest = Number(el.dataset.slide);
      }
    });

    return nearest;
  }, []);

  const goTo = useCallback((index: number) => {
    const rail = railRef.current;
    const slide = rail?.querySelector<HTMLElement>(`[data-slide="${index}"]`);
    if (!rail || !slide) return;

    rail.scrollTo({
      left: slide.offsetLeft - (rail.clientWidth - slide.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, []);

  // Keep the progress rule in step with wherever the rail actually is.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const sync = () => setActive(nearestIndex());

    sync();
    rail.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);

    return () => {
      rail.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [nearestIndex]);

  // The automatic advance.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    // Content that moves on its own is exactly what this setting asks us not
    // to do — leave it as a plain swipeable rail instead.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Don't cycle through the whole set while it's off screen; the visitor
    // would arrive part-way through with no idea they'd missed anything.
    let onScreen = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
      },
      { threshold: 0.4 }
    );
    observer.observe(rail);

    const hold = () => {
      pausedUntil.current = Date.now() + RESUME_AFTER_MS;
    };

    rail.addEventListener("pointerdown", hold, { passive: true });
    rail.addEventListener("touchstart", hold, { passive: true });
    rail.addEventListener("wheel", hold, { passive: true });

    const timer = window.setInterval(() => {
      if (!onScreen || Date.now() < pausedUntil.current) return;
      if (document.hidden) return;

      // Read the position off the rail each tick rather than closing over
      // state, so this can't drift out of sync with a swipe.
      goTo((nearestIndex() + 1) % dishes.length);
    }, ADVANCE_MS);

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      rail.removeEventListener("pointerdown", hold);
      rail.removeEventListener("touchstart", hold);
      rail.removeEventListener("wheel", hold);
    };
  }, [dishes.length, goTo, nearestIndex]);

  return (
    <section className="relative overflow-hidden py-14 lg:hidden">
      <div className="glow left-[-15%] top-1/4 h-[380px] w-[380px] opacity-70" />

      {/* Native scroll-snap underneath, so a swipe keeps its momentum and the
          timer is only ever nudging the same rail along. `relative` makes the
          rail the offsetParent, which the centring maths above relies on. */}
      <div
        ref={railRef}
        className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
      >
        {/* Gutters, so the first and last slides sit inset rather than flush. */}
        <div className="w-5 shrink-0 sm:w-8" aria-hidden />

        {dishes.map((dish, i) => (
          <article
            key={dish.id}
            data-slide={i}
            className={`relative shrink-0 snap-center transition-opacity duration-500 ${
              i === active ? "opacity-100" : "opacity-55"
            }`}
            style={{ width: "min(82vw, 420px)" }}
          >
            {/* One ratio for every slide — the rail's height has to stay put
                while it advances on its own, or the page jumps underneath. */}
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image
                src={dish.image}
                alt={dish.alt}
                fill
                priority={i === 0}
                sizes="(max-width: 640px) 82vw, 420px"
                className="object-cover"
              />

              {/* Hairline mount, inset — reads as a print rather than a card. */}
              <span className="pointer-events-none absolute inset-2.5 border border-white/10" />
            </div>
          </article>
        ))}

        <div className="w-5 shrink-0 sm:w-8" aria-hidden />
      </div>

      <div className="relative mt-7 flex items-center gap-5 px-5 sm:px-8">
        <span className="h-px flex-1 bg-white/12">
          <span
            className="block h-full bg-[var(--gold)] transition-all duration-500 ease-out"
            style={{ width: `${((active + 1) / dishes.length) * 100}%` }}
          />
        </span>

        <Link
          href="/menu"
          className="shrink-0 border-b border-[var(--gold)]/50 pb-0.5 text-sm text-[var(--gold)]"
        >
          Full menu
        </Link>
      </div>
    </section>
  );
}
