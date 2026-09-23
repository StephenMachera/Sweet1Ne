"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { openBookingModal } from "./booking-modal";

const NAV = [
  { href: "/menu", label: "MENU" },
  { href: "/order", label: "ORDER" },
  { href: "/story", label: "OUR STORY" },
  { href: "/events", label: "EVENTS" },
  { href: "/locations", label: "BOOK A TABLE" },
  { href: "/contact", label: "CONTACT" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [isPage, setIsPage] = useState(false);
  const [open, setOpen] = useState(false);

  // Transparent over the film, solid past it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (pathname !== "/") return;

    const cinema = document.querySelector("[data-cinema]");
    if (!cinema || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsPage(!entry.isIntersecting),
      { threshold: 0.48 }
    );
    observer.observe(cinema);

    return () => observer.disconnect();
  }, [pathname]);

  // Stop the page scrolling behind the takeover.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape closes it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const overFilm = !scrolled && !open;
  const isHome = pathname === "/";
  const isMenu = pathname === "/menu";
  const isEvents = pathname === "/events";
  const isContact = pathname === "/contact";

  return (
    <>
      {/* z-[70] puts the header above the mobile takeover, so the logo and
          close button stay visible over it. */}
      <header
        className={`site-header fixed inset-x-0 top-0 z-[70] font-body transition-colors duration-500 ${
          isHome ? "is-home" : "is-page"
        } ${
          isHome && isPage
            ? "is-page border-b-0"
            : isHome && !isPage
              ? "border-b-0"
              : "border-b border-[rgba(201,162,74,.14)] bg-[#050505]/96 backdrop-blur"
        }`}
        style={
          overFilm && !isPage && !isMenu && !isEvents && !isContact
            ? {
                // A scrim rather than a solid bar — keeps the nav legible
                // over a bright frame without dimming the film itself. The
                // pack's curve: dense at the top, most of the way gone by
                // the lower third, so it reads as shadow rather than a band.
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,.78) 0%, rgba(0,0,0,.28) 58%, transparent 100%)",
              }
            : isMenu || isEvents || isContact
              ? { background: "#000" }
              : undefined
        }
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="relative block h-11 w-16 shrink-0 sm:h-12 sm:w-[72px]"
          >
            <Image
              src="/images/brand/logo.png"
              alt="Sweet1NE"
              fill
              priority
              // contain, never cover — a logo must not be cropped.
              className="object-contain object-left"
              sizes="72px"
            />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`text-xs transition-colors ${
                  pathname === item.href
                    ? "text-[var(--gold)]"
                    : "text-white hover:text-[var(--gold)]"
                }`}
                // Sits over video, so the type needs its own separation from
                // whatever's behind it.
                style={{ textShadow: "0 1px 3px rgba(0,0,0,.6)" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Ghost rather than a solid slab — a filled gold button over
                film reads as an advert. */}
            <Link href="/locations" className="book">
              Reservations
            </Link>

            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="flex h-11 w-11 items-center justify-center text-white lg:hidden"
              style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,.6))" }}
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

      {/* Full-screen takeover. Stays mounted so it can fade out as well as
          in — a component that unmounts can't animate its exit. */}
      <div
        className={`fixed inset-0 z-50 ${isHome || isMenu || isEvents || isContact ? "bg-black" : "bg-[#0e0e0e]"} transition-opacity duration-500 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="glow left-1/2 top-1/3 h-[380px] w-[380px] -translate-x-1/2" />

        <nav className="relative flex h-full flex-col justify-center px-6 pb-32 pt-24">
          {NAV.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
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
          <div className="flex gap-3">
            
            <a  href="https://instagram.com/sweet1necuisine"
              target="_blank"
              rel="noreferrer"
              className="flex-1 border border-[var(--ivory)]/25 py-3.5 text-center text-sm"
              style={{ borderRadius: "4px" }}
            >
              Instagram
            </a>
            
            <a href="https://tiktok.com/@sweet1necuisine"
              target="_blank"
              rel="noreferrer"
              className="flex-1 border border-[var(--ivory)]/25 py-3.5 text-center text-sm"
              style={{ borderRadius: "4px" }}
            >
              TikTok
            </a>
          </div>
        </div>
      </div>
    </>
  );
}