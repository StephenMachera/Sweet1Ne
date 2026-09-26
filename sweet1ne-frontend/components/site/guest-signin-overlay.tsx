"use client";

import { NewsletterForm } from "./newsletter-form";

/** Shown once per device, before the menu, on the table's own order page —
   never a gate: "Skip" is exactly as easy to reach as subscribing, and
   nothing here is required to see the menu or order. Consent is the
   NewsletterForm's own checkbox, same PECR-compliant opt-in used
   everywhere else a guest's email is asked for. Uses the order page's own
   guest-* theme tokens (light/dark, orange accent) rather than the
   marketing site's dark-gold palette, since it renders inside that page. */
export function GuestSignInOverlay({ onDone }: { onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-guest-bg px-6 text-center text-guest-text">
      <p className="text-xs font-semibold uppercase tracking-wide text-guest-accent">Before you order</p>
      <h2 className="mt-3 text-2xl font-semibold">Hear from us?</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm text-guest-muted">
        Leave your email for offers and news — entirely optional, and you can order either way.
      </p>

      <div className="mt-6 w-full max-w-xs">
        <NewsletterForm variant="guest" source="qr" onSubscribed={onDone} />
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-6 text-sm text-guest-muted underline underline-offset-4 hover:text-guest-text"
      >
        Skip for now
      </button>
    </div>
  );
}
