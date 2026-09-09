"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RESERVATION_URLS } from "@/lib/site-content";

const OPEN_EVENT = "sweet1ne:open-booking-modal";

/**
 * Every generic "Book a table" trigger calls this rather than linking
 * straight to a branch — there are two restaurants, and nothing about a
 * plain "Book a table" button says which one. `<BookingModal />` (mounted
 * once in the site layout) listens for the event this fires and asks.
 *
 * A trigger that already knows the branch (the location cards' "Book
 * Lewisham" / "Book Chingford" buttons) should link straight to
 * RESERVATION_URLS[slug] instead — asking again there would be redundant.
 */
export function openBookingModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_EVENT));
  }
}

/**
 * Drop-in replacement for a `<Link href={...} target="_blank">Book a
 * table</Link>` inside a Server Component page, which can't hold an
 * onClick itself. Client Components that already trigger the modal
 * directly (the header, hero, footer) don't need this — they can call
 * openBookingModal() from their own onClick.
 */
export function BookTableButton({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button type="button" onClick={openBookingModal} className={className} style={style}>
      {children}
    </button>
  );
}

export function BookingModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  // Stop the page scrolling behind it, same as the mobile nav takeover.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0e0e0e]/80 px-5 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-sm border border-[var(--hairline)] bg-[#131313] p-8"
        style={{ borderRadius: "4px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-4 top-4 text-[var(--ivory-dim)] transition-colors hover:text-[var(--ivory)]"
        >
          <X size={20} strokeWidth={1} />
        </button>

        <p className="label-caps text-[var(--gold)]">Book a table</p>
        <h2 className="mt-2 font-display text-2xl text-[var(--ivory)]">Which restaurant?</h2>

        <div className="mt-6 space-y-3">
          <a
            href={RESERVATION_URLS.lewisham}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block border border-[var(--ivory)]/25 px-5 py-4 text-center font-semibold text-[var(--ivory)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
            style={{ borderRadius: "4px" }}
          >
            Lewisham
          </a>
          <a
            href={RESERVATION_URLS.chingford}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block border border-[var(--ivory)]/25 px-5 py-4 text-center font-semibold text-[var(--ivory)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
            style={{ borderRadius: "4px" }}
          >
            Chingford
          </a>
        </div>
      </div>
    </div>
  );
}
