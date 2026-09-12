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
      <section className="mx-auto max-w-[62rem] px-[1.15rem] py-[2.6rem] text-center sm:px-6 sm:py-[3.4rem]">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          And so the journey continues
        </p>

        <h2 className="mb-3.5 font-display text-[clamp(1.9rem,4vw,3rem)] font-medium leading-tight tracking-[-0.02em]">
          Follow along.
        </h2>

        <p className="mx-auto mb-8 max-w-[30rem] text-[var(--ivory-dim)]">
          The rooms grew. The kitchen stayed. Come sit — then keep the table
          with us.
        </p>

        <nav
          aria-label="Follow Sweet1NE"
          className="flex justify-center gap-3.5"
        >
          {SOCIALS.map(({ href, label, Icon }) => (
            
            <a  key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              className="grid h-12 w-12 place-items-center border border-[rgba(201,162,74,.45)] text-[var(--gold)] transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:text-[#0e0e0e]"
              style={{ borderRadius: "3px" }}
            >
              <Icon size={20} />
            </a>
          ))}
        </nav>
      </section>

      <section className="px-[1.15rem] pb-12 pt-2 text-center sm:px-6">
        <p className="font-display text-[clamp(1.4rem,3vw,2rem)] italic">
          Always in the mood for you.
        </p>
      </section>
    </>
  );
}