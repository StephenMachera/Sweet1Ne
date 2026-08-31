"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "sweet1ne_cookie_consent";

export type ConsentChoice = "accepted" | "rejected";

/** Read the stored choice — used by the analytics component to decide
 *  whether to load anything at all. */
export function getStoredConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "accepted" || stored === "rejected" ? stored : null;
}

/**
 * Cookie consent.
 *
 * Under PECR, non-essential cookies need consent BEFORE they're set — so
 * nothing tracking-related loads until someone accepts. The ICO is also
 * explicit that rejecting must be as easy as accepting, which is why both
 * buttons are equally prominent rather than one being a buried link.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only ask people who haven't already answered.
    if (getStoredConsent() === null) {
      // A short delay so it doesn't collide with the hero on arrival.
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  function choose(choice: ConsentChoice) {
    window.localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
    // Tell the analytics component to load (or not) without a page reload.
    window.dispatchEvent(new CustomEvent("sweet1ne:consent", { detail: choice }));
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-[90] p-4 sm:p-6"
    >
      <div
        className="mx-auto max-w-2xl border border-[var(--hairline)] bg-[#131313] p-5 shadow-2xl sm:p-6"
        style={{ borderRadius: "4px" }}
      >
        <div className="flex items-start gap-4">
          <Cookie
            size={20}
            strokeWidth={1}
            className="mt-0.5 hidden shrink-0 text-[var(--gold)] sm:block"
          />

          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight text-[var(--ivory)]">
              A quick word about cookies
            </p>

            <p className="mt-2 text-sm leading-relaxed text-[var(--ivory-dim)]">
              We'd like to use analytics and advertising cookies to understand how
              people find us and to show our ads to the right people. They're
              entirely optional — the site works the same either way.{" "}
              <Link
                href="/privacy"
                className="border-b border-[var(--ivory)]/30 hover:border-[var(--gold)] hover:text-[var(--gold)]"
              >
                Read our privacy policy
              </Link>
              .
            </p>

            {/* Equal weight, deliberately — rejecting has to be as easy as
                accepting. */}
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <button
                onClick={() => choose("accepted")}
                className="bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-[#0e0e0e] transition-colors hover:bg-[var(--gold-deep)]"
                style={{ borderRadius: "4px" }}
              >
                Accept
              </button>
              <button
                onClick={() => choose("rejected")}
                className="border border-[var(--ivory)]/40 px-6 py-3 text-sm font-semibold text-[var(--ivory)] transition-colors hover:border-[var(--ivory)]"
                style={{ borderRadius: "4px" }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}