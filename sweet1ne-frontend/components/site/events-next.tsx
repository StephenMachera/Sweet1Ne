"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SOCIAL_LINKS } from "@/lib/site-content";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "./social-icons";
import { NewsletterForm } from "./newsletter-form";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const POSTER = "/images/homepage-gallery/events/poster-events.jpg";

/** Listed nights rotate at this pace when there's more than one. */
const ROTATE_MS = 8000;

const SOCIALS = [
  { href: SOCIAL_LINKS.instagram, label: "Instagram", Icon: InstagramIcon },
  { href: SOCIAL_LINKS.facebook, label: "Facebook", Icon: FacebookIcon },
  { href: SOCIAL_LINKS.tiktok, label: "TikTok", Icon: TikTokIcon },
];

/** What /public/events returns — upcoming, published, soonest first. */
type Night = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  image_url: string | null;
  starts_at: string;
  branch_name: string | null;
};

function formatWhen(night: Night) {
  const d = new Date(night.starts_at);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
  return [date, time, night.branch_name].filter(Boolean).join(" · ");
}

/**
 * What's next — built to events.html.
 *
 * Reads the listed nights from the staff Events system. If there's more
 * than one they rotate, with dots to pick; if there are none, the empty
 * state is the design: say so plainly over a still of the room, with the
 * socials, rather than a blank panel or an invented placeholder. Dates are
 * never made up here — they're whatever staff have published.
 */
export function EventsNext() {
  const [nights, setNights] = useState<Night[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/public/events`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Night[]) => {
        if (!cancelled && Array.isArray(rows)) setNights(rows);
      })
      .catch(() => {
        // Unreachable API reads the same as nothing listed.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Rotation restarts whenever a dot is pressed, so a chosen night gets its
  // full eight seconds.
  useEffect(() => {
    if (nights.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % nights.length),
      ROTATE_MS
    );
    return () => window.clearInterval(timer);
  }, [nights.length, index]);

  const night = nights[index] ?? null;

  return (
    <>
      <section className="next" id="next" aria-label="What’s next">
        <div className="next-media">
          <img className="next-still" src={night?.image_url || POSTER} alt="" />
        </div>
        <span className="next-veil" aria-hidden="true" />

        <div className="next-copy">
          <p className="kicker">What’s next</p>

          {night ? (
            <>
              {formatWhen(night) && <p className="meta">{formatWhen(night)}</p>}
              <h2>{night.title}</h2>
              {(night.tagline || night.description) && (
                <p className="dek">{night.tagline || night.description}</p>
              )}
              <div className="acts">
                <Link href="/locations" className="book">
                  Book
                </Link>
                {night.description && (
                  <Link href={`/events/${night.slug}`} className="book">
                    Details
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <h2>Nothing listed yet.</h2>
              <p className="dek">
                When a night is on, it will sit here. Follow along, or join the list.
              </p>
              <nav className="socials socials-lg" aria-label="Follow Sweet1NE">
                {SOCIALS.map(({ href, label, Icon }) => (
                  <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}>
                    <Icon size={19} />
                  </a>
                ))}
              </nav>
            </>
          )}

          {nights.length > 1 && (
            <div className="next-dots">
              {nights.map((row, i) => (
                <button
                  key={row.id}
                  type="button"
                  className={i === index ? "is-on" : undefined}
                  aria-current={i === index ? "true" : undefined}
                  aria-label={`${row.title}, ${i + 1} of ${nights.length}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="know">
        <p className="kicker">Stay close</p>
        <h2>Join the list.</h2>
        <p className="dek">New dishes and event nights. Unsubscribe any time.</p>
        <NewsletterForm variant="order" />
      </section>

      <section className="mood" id="book">
        <p>Always in the mood for you.</p>
      </section>
    </>
  );
}
