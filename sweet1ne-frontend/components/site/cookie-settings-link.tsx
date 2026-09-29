"use client";

/** Reopens the cookie banner (see CookieConsent) so a guest can change an
 * earlier choice without clearing cookies by hand. */
export function CookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("sweet1ne:open-cookie-settings"))}
      className="border-b border-[var(--ivory)]/30 hover:border-[var(--gold)] hover:text-[var(--gold)]"
    >
      Cookie Settings
    </button>
  );
}
