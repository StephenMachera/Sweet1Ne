import { SOCIAL_LINKS } from "@/lib/site-content";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "./social-icons";

const SOCIALS = [
  { href: SOCIAL_LINKS.instagram, label: "Instagram", Icon: InstagramIcon },
  { href: SOCIAL_LINKS.facebook, label: "Facebook", Icon: FacebookIcon },
  { href: SOCIAL_LINKS.tiktok, label: "TikTok", Icon: TikTokIcon },
];

/**
 * The close — larger social marks than the footer's, since here they're the
 * point rather than a formality.
 */
export function StoryFollow() {
  return (
    <>
      <section className="story-follow mx-auto max-w-[62rem] px-[1.15rem] pb-[0.4rem] pt-[2.8rem] text-center sm:px-8 sm:pb-[0.6rem] sm:pt-[3.2rem]">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          And so the journey continues
        </p>

        <h2 className="mb-3.5 font-display text-[clamp(1.9rem,4vw,3rem)] font-medium leading-tight tracking-[-0.02em]">
          Follow along.
        </h2>

        <p className="mx-auto mb-[1.35rem] max-w-[28rem] text-[var(--ivory-dim)]">
          The kitchen stayed at the centre.
        </p>

        <nav className="flex justify-center gap-3" aria-label="Follow Sweet1NE">
          {SOCIALS.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              className="grid h-10 w-10 place-items-center rounded-[3px] border border-[rgba(201,162,74,.35)] text-[var(--gold)] transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:text-[#0e0e0e]"
            >
              <Icon size={17} />
            </a>
          ))}
        </nav>
      </section>

      <section className="px-[1.15rem] pb-4 pt-0 text-center sm:px-6">
        <p className="font-display text-[clamp(1.4rem,3vw,2rem)] italic">
          Always in the mood for you.
        </p>
      </section>
    </>
  );
}