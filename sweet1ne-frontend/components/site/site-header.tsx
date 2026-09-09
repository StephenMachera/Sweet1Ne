"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/site-content";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "./social-icons";
import { openBookingModal } from "./booking-modal";

const NAV = [
  { href: "/menu", label: "Menu" },
  { href: "/order", label: "Order" },
  { href: "/story", label: "Our Story" },
  { href: "/events", label: "Events" },
  { href: "/locations", label: "Locations" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // Transparent over the hero, solid past it — so the video isn't competing
  // with a bar across the top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Stop the page scrolling behind the takeover.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape closes it — cheap to support, and expected.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* z-[70] puts the header above the takeover, so the logo and close
          button stay visible over it. */}
      <header
        className={`fixed inset-x-0 top-0 z-[70] transition-colors duration-500 ${
          scrolled && !open
            ? "border-b border-[var(--hairline-faint)] bg-[#0e0e0e]/95 backdrop-blur"
            : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="relative block h-11 w-16 shrink-0 sm:h-12 sm:w-[72px]">
            <Image
              src="/images/brand/logo.png"
              alt="Sweet1NE"
              fill
              priority
              // contain, never cover — a logo must not be cropped.
              className="object-contain object-left"
              sizes="85px"
            />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm ${
                  pathname === item.href
                    ? "text-[var(--gold)]"
                    : "text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Visible at every width — booking is the action that matters,
                so it never hides behind a hamburger. */}
            <button
              type="button"
              onClick={openBookingModal}
              className="bg-[var(--gold)] px-5 py-3 text-[13px] font-semibold text-[#0e0e0e] hover:bg-[var(--gold-deep)] sm:px-6 sm:text-sm"
              style={{ borderRadius: "4px" }}
            >
              Book
              <span className="hidden sm:inline"> a table</span>
            </button>

            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="flex h-11 w-11 items-center justify-center text-[var(--ivory)] lg:hidden"
            >
              {open ? (
                <X size={24} strokeWidth={1} />
              ) : (
                <Menu size={24} strokeWidth={1} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen takeover. A moment rather than a dropdown — which suits
          a site this atmospheric, and gives the links room to breathe.
          Stays mounted so it can fade out as well as in. */}
      <div
        className={`fixed inset-0 z-50 bg-[#0e0e0e] transition-opacity duration-500 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="glow left-1/2 top-1/3 h-[380px] w-[380px] -translate-x-1/2" />

        <nav className="relative flex h-full flex-col justify-center px-6 pb-32 pt-24">
          {NAV.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={`border-b border-white/[0.06] py-4 font-display text-[2rem] leading-tight transition-all duration-500 last:border-0 ${
                pathname === item.href ? "text-[var(--gold)]" : "text-[var(--ivory)]"
              } ${open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
              // Links arrive one after another rather than all at once —
              // 60ms apart is enough to feel considered, not slow.
              style={{ transitionDelay: open ? `${120 + i * 60}ms` : "0ms" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Anchored at the bottom, thumb-reachable. Someone opening this menu
            came from Instagram — giving them a way back is more useful than
            another nav link. */}
        <div className="absolute inset-x-0 bottom-0 border-t border-[var(--hairline-faint)] px-6 py-6">
          <p className="label-caps mb-3 text-[var(--gold)]">
            100% Halal · Lewisham &amp; Chingford
          </p>
          <div className="flex gap-3">
            <a
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="flex flex-1 items-center justify-center border border-[var(--ivory)]/25 py-3.5"
              style={{ borderRadius: "4px" }}
            >
              <InstagramIcon size={20} />
            </a>

            <a
              href={SOCIAL_LINKS.facebook}
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="flex flex-1 items-center justify-center border border-[var(--ivory)]/25 py-3.5"
              style={{ borderRadius: "4px" }}
            >
              <FacebookIcon size={20} />
            </a>

            <a
              href={SOCIAL_LINKS.tiktok}
              target="_blank"
              rel="noreferrer"
              aria-label="TikTok"
              className="flex flex-1 items-center justify-center border border-[var(--ivory)]/25 py-3.5"
              style={{ borderRadius: "4px" }}
            >
              <TikTokIcon size={20} />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}