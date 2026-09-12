import Link from "next/link";
import { SOCIAL_LINKS } from "@/lib/site-content";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "./social-icons";

const SOCIALS = [
  { href: SOCIAL_LINKS.instagram, label: "Instagram", Icon: InstagramIcon },
  { href: SOCIAL_LINKS.facebook, label: "Facebook", Icon: FacebookIcon },
  { href: SOCIAL_LINKS.tiktok, label: "TikTok", Icon: TikTokIcon },
];

const LEGAL = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  // Findable if you know to look, invisible if you don't.
  { href: "/login", label: "Staff login" },
];

/**
 * Centred and quiet — this sits at the bottom of every page that has one,
 * so it shouldn't compete with whatever came before it.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[rgba(229,226,225,.08)] px-[1.15rem] pb-10 pt-12 text-center sm:px-6 sm:pt-14">
      <div className="mb-6 flex justify-center gap-2.5">
        {SOCIALS.map(({ href, label, Icon }) => (
          
          <a  key={label}
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            className="grid h-9 w-9 place-items-center border border-[rgba(201,162,74,.35)] text-[var(--gold)] transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:text-[#0e0e0e]"
            style={{ borderRadius: "3px" }}
          >
            <Icon size={15} />
          </a>
        ))}
      </div>

      <p className="text-[0.78rem] text-[var(--ivory-dim)]">
        © {new Date().getFullYear()} Sweet1NE Cuisine. All rights reserved.
      </p>

      {/* A rule beneath the links rather than around them — inline-flex so
          it's only as wide as the links themselves. */}
      <div className="mx-auto mt-4 inline-flex flex-wrap justify-center gap-x-7 gap-y-2 border-b border-[rgba(229,226,225,.12)] pb-4">
        {LEGAL.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--ivory-dim)] transition-colors hover:text-[var(--gold)]"
          >
            {item.label}
          </Link>
        ))}
      </div>

      <p className="mt-6 text-[0.45rem] uppercase tracking-[0.18em] text-[rgba(229,226,225,.38)]">
        This website is powered by
      </p>
      <p className="mt-1 font-display text-[0.65rem] italic text-[var(--gold)]">
        Global Solutions x Spectre Limited
      </p>
    </footer>
  );
}