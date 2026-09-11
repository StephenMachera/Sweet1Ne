"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Course = {
  id: string;
  label: string;
  image: string;
  /** Circular crops are unforgiving, so a couple of images need nudging. */
  objectPosition?: string;
};

const COURSES: Course[] = [
  {
    id: "starters",
    label: "Starters",
    image: "/images/homepage-gallery/menu/course-starters.jpg",
    objectPosition: "42% 46%",
  },
  { id: "mains", label: "Mains", image: "/images/homepage-gallery/menu/course-mains.jpg" },
  { id: "pasta", label: "Pasta", image: "/images/homepage-gallery/menu/course-pasta.jpg" },
  { id: "seafood", label: "Seafood", image: "/images/homepage-gallery/menu/course-seafood.jpg" },
  { id: "desserts", label: "Desserts", image: "/images/homepage-gallery/menu/course-desserts.jpg" },
  { id: "bar", label: "The bar", image: "/images/homepage-gallery/menu/course-bar.jpg" },
];

/**
 * The course navigation — circular emblems rather than text chips, matching
 * the homepage's language.
 *
 * Sits below the fixed header and tracks which chapter you're reading. Sides
 * and Kids are text links beneath: they're short sections, and giving them
 * emblems would imply an equivalence that isn't there.
 */
export function CourseNav() {
  const [active, setActive] = useState("starters");
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // The band either side means a chapter counts as "current" only once
    // it's genuinely occupying the middle of the screen.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -45% 0px", threshold: 0.1 }
    );

    COURSES.forEach((course) => {
      const el = document.getElementById(course.id);
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
    <div
      className="sticky top-[3.45rem] z-40 border-b border-[rgba(201,162,74,.12)] pb-[0.55rem] pt-[0.7rem] sm:top-[4.2rem]"
      style={{
        background:
          "linear-gradient(to bottom, rgba(14,14,14,.96), rgba(14,14,14,.82))",
      }}
    >
      <nav
        ref={railRef}
        aria-label="Courses"
        className="flex gap-3 overflow-x-auto px-[1.15rem] pb-[0.15rem] pt-[0.35rem] sm:gap-4 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {COURSES.map((course) => {
          const isActive = active === course.id;

          return (
            <Link
              key={course.id}
              href={`#${course.id}`}
              data-course={course.id}
              className={`w-[4.85rem] shrink-0 text-center text-[0.58rem] uppercase tracking-[0.14em] transition-colors sm:w-[6.1rem] ${
                isActive ? "text-[var(--gold)]" : "text-[var(--ivory-dim)]"
              }`}
            >
              <span
                className="relative mx-auto mb-2 block aspect-square w-full overflow-hidden rounded-full bg-[#1a1814] transition-shadow duration-500"
                style={{
                  // A thin gold ring, then a thick near-black one that
                  // separates each emblem from its neighbour.
                  boxShadow: isActive
                    ? "0 0 0 2px var(--gold), 0 0 0 8px rgba(14,14,14,.94)"
                    : "0 0 0 1px rgba(201,162,74,.38), 0 0 0 7px rgba(14,14,14,.92)",
                }}
              >
                <Image
                  src={course.image}
                  alt=""
                  fill
                  sizes="(max-width: 720px) 78px, 98px"
                  className="object-cover"
                  style={
                    course.objectPosition
                      ? { objectPosition: course.objectPosition }
                      : undefined
                  }
                />
              </span>
              {course.label}
            </Link>
          );
        })}
      </nav>

      <p className="mx-[1.15rem] mt-[0.15rem] text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ivory-dim)] sm:mx-6">
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