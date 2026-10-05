"use client";

import { NewsletterForm } from "./newsletter-form";

/** Shown once per device, before the menu, on the table's own order page —
   a required step: the guest must submit their email (with consent ticked)
   to reach the menu, with no way to skip past it. Consent is the
   NewsletterForm's own checkbox, same PECR-compliant opt-in used
   everywhere else a guest's email is asked for. Uses the order page's own
   guest-* theme tokens (light/dark, gold-on-black to match the admin/site
   dark theme) rather than a separate palette, since it renders inside that
   page. */
export function GuestSignInOverlay({ onDone }: { onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-guest-bg px-6 text-center text-guest-text">
      <p className="text-xs font-semibold uppercase tracking-wide text-guest-accent">Before you order</p>
      <h2 className="mt-3 text-2xl font-semibold">Hear from us?</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm text-guest-muted">
        Leave your email for offers and news before you see the menu.
      </p>

      <div className="mt-6 w-full max-w-xs">
        <NewsletterForm variant="guest" source="qr" onSubscribed={onDone} />
      </div>
    </div>
  );
}
