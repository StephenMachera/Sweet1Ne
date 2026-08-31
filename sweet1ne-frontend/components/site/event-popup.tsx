"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, X } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const DISMISS_PREFIX = "sweet1ne_event_dismissed_";
const APPEAR_AFTER_MS = 2500;

type Event = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  image_url: string | null;
  starts_at: string;
  branch_name: string | null;
};

/**
 * Announces the next upcoming event.
 *
 * Shows once per event, not once per visit — the dismissal is stored against
 * the event's id, so closing it hides that event for good while a new one
 * still gets its moment. Waits a couple of seconds so the hero lands first.
 */
export function EventPopup() {
  const [event, setEvent] = useState<Event | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/public/events/next`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Event | null) => {
        if (cancelled || !data) return;

        // Already seen and dismissed this one.
        if (window.localStorage.getItem(`${DISMISS_PREFIX}${data.id}`)) return;

        setEvent(data);
        // Let the hero be the first thing they see.
        setTimeout(() => !cancelled && setVisible(true), APPEAR_AFTER_MS);
      })
      .catch(() => {
        // No event, or the API is unreachable — either way, stay quiet.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    if (event) {
      window.localStorage.setItem(`${DISMISS_PREFIX}${event.id}`, "1");
    }
    setVisible(false);
  }

  // Escape closes it.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, event]);

  if (!event) return null;

  const when = new Date(event.starts_at).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-end justify-center p-4 transition-opacity duration-500 sm:items-center sm:p-6 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={`Upcoming event: ${event.title}`}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden
      />

      <div
        className={`relative w-full max-w-md overflow-hidden border border-[var(--hairline)] bg-[#131313] transition-transform duration-500 ${
          visible ? "translate-y-0" : "translate-y-6"
        }`}
        style={{ borderRadius: "4px" }}
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center bg-black/40 text-[var(--ivory)] backdrop-blur transition-colors hover:text-[var(--gold)]"
          style={{ borderRadius: "4px" }}
        >
          <X size={18} strokeWidth={1} />
        </button>

        {event.image_url && (
          <div className="relative aspect-[16/10] w-full">
            <Image
              src={event.image_url}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 448px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-transparent to-transparent" />
          </div>
        )}

        <div className="p-6 sm:p-7">
          <p className="label-caps text-[var(--gold)]">Coming up</p>

          <h2 className="mt-3 font-display text-[1.75rem] leading-tight">
            {event.title}
          </h2>

          {event.tagline && (
            <p className="mt-2.5 text-sm leading-relaxed text-[var(--ivory-dim)]">
              {event.tagline}
            </p>
          )}

          <div className="mt-5 space-y-2.5 border-t border-[var(--hairline-faint)] pt-5">
            <p className="flex items-center gap-2.5 text-sm text-[var(--ivory-dim)]">
              <CalendarDays size={15} strokeWidth={1} className="shrink-0" />
              {when}
            </p>
            {event.branch_name && (
              <p className="flex items-center gap-2.5 text-sm text-[var(--ivory-dim)]">
                <MapPin size={15} strokeWidth={1} className="shrink-0" />
                {event.branch_name}
              </p>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              href={`/events/${event.slug}`}
              onClick={dismiss}
              className="inline-flex flex-1 items-center justify-center gap-2 bg-[var(--gold)] px-5 py-3.5 text-sm font-semibold text-[#0e0e0e] transition-colors hover:bg-[var(--gold-deep)]"
              style={{ borderRadius: "4px" }}
            >
              Explore
              <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
            <button
              onClick={dismiss}
              className="border border-[var(--ivory)]/25 px-5 py-3.5 text-sm text-[var(--ivory-dim)] transition-colors hover:border-[var(--ivory)]/50 hover:text-[var(--ivory)]"
              style={{ borderRadius: "4px" }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}