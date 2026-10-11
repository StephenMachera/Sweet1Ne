"use client";

import Image from "next/image";
import Link from "next/link";

/**
 * The admin rail's mobile face — a sticky top bar with a hamburger, the
 * brand mark, the current page name, and Sign out.
 *
 * This is `.rail-bar` from the shared admin CSS/JS: at desktop widths the
 * stylesheet collapses it to `display: contents` and hides everything but
 * the brand mark (`.admin-rail-home`, rendered separately by the sidebar),
 * so this component only actually shows below the 960px breakpoint. The
 * hamburger's bars-to-X animation is driven by the parent `.admin-rail`
 * carrying `is-open` — see globals.css — not by anything here.
 */
export function MobileHeader({
  open,
  onToggle,
  pageLabel,
  brandHref,
  branchName,
  onSignOut,
}: {
  open: boolean;
  onToggle: () => void;
  pageLabel: string;
  brandHref: string;
  branchName?: string;
  onSignOut: () => void;
}) {
  return (
    <div className="admin-rail-bar">
      <button
        type="button"
        className="admin-rail-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-controls="admin-menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span />
      </button>

      <div className="admin-rail-brand">
        <Link href={brandHref} className="admin-rail-home">
          <Image
            src="/images/brand/logo.png"
            alt="Sweet1NE"
            width={612}
            height={408}
            className="mx-auto w-[7.4rem]"
            priority
          />
          {/* Which branch this staff member is scoped to — admin has no
             equivalent (it isn't scoped to one), so this is the one
             deliberate addition rather than a one-for-one copy. */}
          {branchName && (
            <p className="mt-1 text-center text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-[rgba(201,162,74,0.65)]">
              {branchName}
            </p>
          )}
        </Link>
        <p className="admin-rail-now">{pageLabel}</p>
      </div>

      <button type="button" className="admin-rail-out" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
