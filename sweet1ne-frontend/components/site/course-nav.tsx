"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { COURSES, MENU } from "@/lib/menu-content";

/**
 * Circular emblems rather than text chips. Sits below the header and tracks
 * which chapter you're reading.
 *
 * Sides and Kids are text links beneath — short sections, and giving them
 * emblems would imply an equivalence that isn't there.
 */
export function CourseNav() {
  const [active, setActive] = useState(COURSES[0]);
  const railRef = useRef<HTMLElement>(null);

  const courses = MENU.filter((chapter) => COURSES.includes(chapter.id));

  useEffect(() => {
    // The band either side means a chapter counts as current only once it's
    // genuinely occupying the middle of the screen.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -45% 0px", threshold: 0.1 }
    );

    COURSES.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Keep the active emblem in view — on a phone the rail scrolls, and the
  // current one drifting off the edge would make the nav useless.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const emblem = rail.querySelector<HTMLElement>(`[data-course="${active}"]`);
    if (!emblem) return;

    rail.scrollTo({
      left: emblem.offsetLeft - rail.clientWidth / 2 + emblem.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [active]);

  return (
    <div className="sticky top-[3.7rem] z-40 border-b border-[rgba(201,162,74,.14)] bg-[#050505] pb-[0.45rem] pt-[0.55rem] sm:top-[4.15rem]">
      <nav
        ref={railRef}
        aria-label="Courses"
        className="flex gap-3 overflow-x-auto px-[1.15rem] pb-[0.15rem] pt-[0.35rem] sm:gap-4 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {courses.map((chapter) => {
          const isActive = active === chapter.id;

          return (
            <Link
              key={chapter.id}
              href={`#${chapter.id}`}
              data-course={chapter.id}
              className={`w-[4.7rem] shrink-0 text-center text-[0.58rem] uppercase tracking-[0.14em] transition-colors sm:w-[5.8rem] ${
                isActive ? "text-[var(--gold)]" : "text-[var(--ivory-dim)]"
              }`}
            >
              <span
                className="relative mx-auto mb-2 block aspect-square w-full overflow-hidden rounded-full bg-[#111] transition-shadow duration-500"
                style={{
                  boxShadow: isActive
                    ? "0 0 0 2px var(--gold)"
                    : "0 0 0 1px rgba(201,162,74,.38)",
                }}
              >
                {chapter.mark && (
                  <Image
                    src={chapter.mark}
                    alt=""
                    fill
                    sizes="(max-width: 720px) 76px, 93px"
                    className="object-cover"
                    style={
                      chapter.markPosition
                        ? { objectPosition: chapter.markPosition }
                        : undefined
                    }
                  />
                )}
              </span>
              {chapter.kicker}
            </Link>
          );
        })}
      </nav>

      <p className="mx-[1.15rem] mt-[0.15rem] text-[0.7rem] uppercase tracking-[0.14em] text-[var(--ivory-dim)] sm:mx-6">
        <Link href="#sides" className="text-[var(--ivory-dim)] transition-colors hover:text-[var(--gold)]">
          Sides
        </Link>
        {" · "}
        <Link href="#kids" className="text-[var(--ivory-dim)] transition-colors hover:text-[var(--gold)]">
          Kids
        </Link>
      </p>
    </div>
  );
}