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

  function jumpTo(id: string) {
    const target = document.getElementById(id);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }

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
    <div className="courses-wrap">
      <nav
        ref={railRef}
        aria-label="Courses"
        className="courses"
      >
        {courses.map((chapter) => {
          const isActive = active === chapter.id;

          return (
            <Link
              key={chapter.id}
              href={`#${chapter.id}`}
              data-course={chapter.id}
              onClick={(event) => {
                event.preventDefault();
                jumpTo(chapter.id);
              }}
              className={`course course-${chapter.id} ${isActive ? "is-on" : ""}`}
            >
              <span className="disc">
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

      <p className="course-more">
        <Link
          href="#sides"
          onClick={(event) => {
            event.preventDefault();
            jumpTo("sides");
          }}
        >
          Sides
        </Link>
        {" · "}
        <Link
          href="#kids"
          onClick={(event) => {
            event.preventDefault();
            jumpTo("kids");
          }}
        >
          Kids
        </Link>
      </p>
    </div>
  );
}