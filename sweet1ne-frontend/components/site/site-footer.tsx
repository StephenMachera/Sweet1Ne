"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRight } from "lucide-react";
import { NewsletterForm } from "./newsletter-form";

gsap.registerPlugin(ScrollTrigger);

const EXPLORE = [
  { href: "/menu", label: "Menu" },
  { href: "/order", label: "Order" },
  { href: "/reservations", label: "Book" },
  { href: "/events", label: "Events" },
  { href: "/story", label: "Story" },
  { href: "/locations", label: "Locations" },
];

const ELSEWHERE = [
  { href: "https://instagram.com/sweet1necuisine", label: "Instagram", external: true },
  { href: "https://tiktok.com/@sweet1necuisine", label: "TikTok", external: true },
  { href: "https://deliveroo.co.uk", label: "Deliveroo", external: true },
  { href: "https://ubereats.com", label: "Uber Eats", external: true },
  { href: "/contact", label: "Contact", external: false },
];

export function SiteFooter() {
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = linksRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // Each column arrives from its own side, links staggered within it.
      // Kept brief — this is the last thing on the page, so elaborate
      // motion here is effort almost nobody sees.
      gsap.fromTo(
        el.querySelectorAll(".footer-left"),
        { x: -24, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.06,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        }
      );

      gsap.fromTo(
        el.querySelectorAll(".footer-right"),
        { x: 24, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.06,
          delay: 0.1,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <footer className="relative z-10 border-t border-[var(--hairline-faint)] bg-[#131313]">
      <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        {/* Newsletter first — it's the thing management asked for, and
            burying it under link columns would waste it. */}
        <div className="grid gap-10 border-b border-[var(--hairline-faint)] pb-12 lg:grid-cols-2 lg:gap-20 lg:pb-14">
          <div>
            <p className="font-display text-[clamp(1.75rem,7vw,2.5rem)] leading-tight">
              Know before
              <br />
              <span className="text-[var(--gold)]">everyone else.</span>
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--ivory-dim)]">
              New dishes, event nights and the odd thing we don't put on
              Instagram.
            </p>
          </div>

          <div className="lg:pt-3">
            <NewsletterForm />
          </div>
        </div>

        {/* Mobile: two columns, arriving from opposite sides. A single
            column of eleven links reads as a wall. */}
        <div ref={linksRef} className="py-12 lg:hidden">
          <div className="grid grid-cols-2 gap-x-6">
            <div>
              <p className="footer-left label-caps mb-5 text-[var(--gold)]">Explore</p>
              <ul className="space-y-4">
                {EXPLORE.map((item) => (
                  <li key={item.href} className="footer-left">
                    <Link
                      href={item.href}
                      className="font-display text-xl text-[var(--ivory)]"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-right">
              <p className="footer-right label-caps mb-5 text-[var(--gold)]">Elsewhere</p>
              <ul className="space-y-4">
                {ELSEWHERE.map((item) => (
                  <li key={item.href} className="footer-right">
                    {item.external ? (
                      
                      <a  href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-display text-xl text-[var(--ivory)]"
                      >
                        {item.label}
                        <ArrowUpRight size={13} strokeWidth={1} className="text-[var(--muted)]" />
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className="font-display text-xl text-[var(--ivory)]"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* The practical bits, once, beneath both columns. */}
          <div className="mt-12 border-t border-[var(--hairline-faint)] pt-8">
            <Link href="/" className="relative block h-14 w-20">
              <Image
                src="/images/brand/logo.png"
                alt="Sweet1NE"
                fill
                className="object-contain object-left"
                sizes="80px"
              />
            </Link>

            <p className="mt-4 max-w-[18rem] text-sm leading-relaxed text-[var(--ivory-dim)]">
              Afro-Caribbean fusion. 100% Halal. Lewisham and Chingford.
            </p>

            
            <a  href="mailto:info@sweet1ne.com"
              className="mt-4 inline-block text-sm text-[var(--ivory-dim)]"
            >
              info@sweet1ne.com
            </a>
          </div>
        </div>

        {/* Desktop: unchanged four-column layout. */}
        <div className="hidden gap-10 py-14 lg:grid lg:grid-cols-4">
          <div>
            <Link href="/" className="relative block h-16 w-24">
              <Image
                src="/images/brand/logo.png"
                alt="Sweet1NE"
                fill
                className="object-contain object-left"
                sizes="96px"
              />
            </Link>
            <p className="mt-4 max-w-[16rem] text-sm leading-relaxed text-[var(--ivory-dim)]">
              Afro-Caribbean fusion. 100% Halal. Lewisham and Chingford.
            </p>
          </div>

          <div>
            <p className="label-caps mb-4 text-[var(--gold)]">Explore</p>
            <ul className="space-y-3">
              {EXPLORE.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-caps mb-4 text-[var(--gold)]">Elsewhere</p>
            <ul className="space-y-3">
              {ELSEWHERE.map((item) => (
                <li key={item.href}>
                  {item.external ? (
                    
                    <a href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="text-sm text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-caps mb-4 text-[var(--gold)]">Get in touch</p>
            <ul className="space-y-3 text-sm text-[var(--ivory-dim)]">
              <li>
                <a href="mailto:info@sweet1ne.com" className="hover:text-[var(--ivory)]">
                  info@sweet1ne.com
                </a>
              </li>
              <li>
                <a href="tel:+442033406750" className="hover:text-[var(--ivory)]">
                  020 3340 6750 · Lewisham
                </a>
              </li>
              <li>
                <a href="tel:+442039713449" className="hover:text-[var(--ivory)]">
                  020 3971 3449 · Chingford
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal */}
        <div className="flex flex-col gap-4 border-t border-[var(--hairline-faint)] pt-8 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Sweet1NE Cuisine. All rights reserved.</p>

          <div className="flex flex-wrap gap-5">
            <Link href="/privacy" className="hover:text-[var(--ivory-dim)]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[var(--ivory-dim)]">
              Terms
            </Link>
            {/* Quiet, but findable — staff need it, customers don't. */}
            <Link href="/login" className="hover:text-[var(--ivory-dim)]">
              Staff login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}