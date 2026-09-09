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
 *  fight over the same track. */
const RESUME_AFTER_MS = 8000;

/** Below this, a touch was a tap or a vertical scroll that drifted — not an
 *  attempt to change the photograph. */
const SWIPE_THRESHOLD_PX = 45;

function MobileDishes({ dishes }: { dishes: Dish[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);

  // A timestamp rather than a boolean: every interaction just pushes the
  // resume time further out, so there's no paused/unpaused state to leak.
  const pausedUntil = useRef(0);
  const touchStartX = useRef(0);

  const count = dishes.length;

  const hold = useCallback(() => {
    pausedUntil.current = Date.now() + RESUME_AFTER_MS;
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    // Content that moves on its own is exactly what this setting asks us not
    // to do — leave it as a plain swipeable strip instead.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAnimate(false);
      return;
    }

    // Don't cycle through the whole set while it's off screen; the visitor
    // would arrive part-way through with no idea they'd missed anything.
    let onScreen = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
      },
      { threshold: 0.4 }
    );
    observer.observe(section);

    const timer = window.setInterval(() => {
      if (!onScreen || document.hidden || Date.now() < pausedUntil.current) return;
      setIndex((i) => (i + 1) % count);
    }, ADVANCE_MS);

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [count]);

  // Swipe is settled on release rather than tracked per-frame: dragging the
  // track live would re-render all seven slides on every touchmove, which is
  // where a carousel like this starts to stutter on a mid-range phone.
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].clientX;
    hold();
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    hold();

    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    setIndex((i) => (dx < 0 ? (i + 1) % count : (i - 1 + count) % count));
  };

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-14 lg:hidden"
      aria-roledescription="carousel"
      aria-label="Signature dishes"
    >
      <div className="glow left-[-15%] top-1/4 h-[380px] w-[380px] opacity-70" />

      {/* A transform on a track, not a scroll position on a rail. The rail
          version had to drive scrollTo({behavior:"smooth"}) against
          scroll-snap-type: mandatory, and the snap engine cancels that
          outright on mobile Safari — so it simply never advanced. */}
      <div className="relative overflow-hidden">
        <div
          className="flex"
          style={{
            transform: `translate3d(-${index * 100}%, 0, 0)`,
            transition: animate ? "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {dishes.map((dish, i) => (
            <article
              key={dish.id}
              className="w-full shrink-0 px-5 sm:px-8"
              aria-hidden={i !== index}
            >
              {/* One ratio for every slide — the track's height has to stay
                  put while it advances on its own, or the page jumps. */}
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src={dish.image}
                  alt={dish.alt}
                  fill
                  // The next one is fetched too, so an advance never lands on
                  // an empty frame.
                  priority={i <= 1}
                  sizes="100vw"
                  className="object-cover"
                />

                {/* Hairline mount, inset — reads as a print rather than a card. */}
                <span className="pointer-events-none absolute inset-2.5 border border-white/10" />
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="relative mt-7 flex items-center gap-5 px-5 sm:px-8">
        <span className="h-px flex-1 bg-white/12">
          <span
            className="block h-full bg-[var(--gold)] transition-all duration-500 ease-out"
            style={{ width: `${((index + 1) / count) * 100}%` }}
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
