import Link from "next/link";
import { NewsletterForm } from "./newsletter-form";

const NAV = [
  { href: "/menu", label: "Menu" },
  { href: "/order", label: "Order" },
  { href: "/story", label: "Our Story" },
  { href: "/events", label: "Events" },
  { href: "/locations", label: "Locations" },
  { href: "/reservations", label: "Reservations" },
  { href: "/contact", label: "Contact" },
];

const SOCIAL = [
  { href: "https://instagram.com/sweet1necuisine", label: "Instagram" },
  { href: "https://tiktok.com/@sweet1necuisine", label: "TikTok" },
];

const DELIVERY = [
  { href: "https://ubereats.com", label: "Uber Eats" },
  { href: "https://deliveroo.co.uk", label: "Deliveroo" },
];

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-[var(--hairline-faint)] bg-[#131313]">
      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-6 sm:py-20">
        {/* Newsletter first — it's the thing management asked for, and
            burying it under link columns would waste it. */}
        <div className="grid gap-10 border-b border-[var(--hairline-faint)] pb-14 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <p className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight">
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

        {/* Links */}
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="font-display text-2xl tracking-tight">
              Sweet1NE
            </Link>
            <p className="mt-3 max-w-[16rem] text-sm leading-relaxed text-[var(--ivory-dim)]">
              Afro-Caribbean fusion. 100% Halal. South East London.
            </p>
          </div>

          <div>
            <p className="label-caps mb-4 text-[var(--gold)]">Explore</p>
            <ul className="space-y-3">
              {NAV.map((item) => (
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
            <p className="label-caps mb-4 text-[var(--gold)]">Follow</p>
            <ul className="space-y-3">
              {SOCIAL.map((item) => (
                <li key={item.href}>
                  
                  <a  href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>

            <p className="label-caps mb-4 mt-8 text-[var(--gold)]">Order in</p>
            <ul className="space-y-3">
              {DELIVERY.map((item) => (
                <li key={item.href}>
                  
                  <a  href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-caps mb-4 text-[var(--gold)]">Get in touch</p>
            <ul className="space-y-3 text-sm text-[var(--ivory-dim)]">
              <li>
                <a href="mailto:hello@sweet1ne.com">hello@sweet1ne.com</a>
              </li>
              <li>
                <a href="tel:+442012345678">+44 20 1234 5678</a>
              </li>
              <li className="pt-2">
                <Link href="/reservations" className="text-[var(--gold)]">
                  Book a table
                </Link>
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