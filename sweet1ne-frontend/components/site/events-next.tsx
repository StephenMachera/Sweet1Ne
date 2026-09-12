import Image from "next/image";
import { SOCIAL_LINKS } from "@/lib/site-content";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "./social-icons";
import { NewsletterForm } from "./newsletter-form";

const SOCIALS = [
  { href: SOCIAL_LINKS.instagram, label: "Instagram", Icon: InstagramIcon },
  { href: SOCIAL_LINKS.facebook, label: "Facebook", Icon: FacebookIcon },
  { href: SOCIAL_LINKS.tiktok, label: "TikTok", Icon: TikTokIcon },
];

/**
 * The empty state, done properly.
 *
 * There are no events listed yet, and saying so plainly over a still of the
 * room is better than a blank panel or an invented placeholder.
 */
export function EventsNext() {
  return (
    <>
      <section
        id="next"
        aria-label="What's next"
        className="relative mt-[2.2rem] min-h-[22rem] scroll-mt-32 overflow-hidden bg-[#0a0a0a]"
      >
        <Image
          src="/images/homepage-gallery/events/poster-events.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[50%_22%] brightness-[0.38] saturate-[0.9]"
        />

        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(5,5,5,.92) 0%, rgba(5,5,5,.5) 55%, rgba(5,5,5,.4) 100%)",
          }}
        />

        <div className="relative z-[1] mx-auto max-w-[34rem] px-[1.15rem] py-[5.5rem] text-center sm:px-6 sm:py-[6rem]">
          <p className="mb-[0.55rem] text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
            What's next
          </p>

          <h2 className="mb-[0.65rem] font-display text-[clamp(1.9rem,4.5vw,3rem)] font-medium leading-[1.08] tracking-[-0.02em]">
            The next night isn't listed yet.
          </h2>

          <p className="mx-auto mb-8 max-w-[32rem] text-[1.02rem] text-[var(--ivory-dim)]">
            When it is, it will live here. Follow along — or join the list and
            hear it first.
          </p>

          <nav
            aria-label="Follow Sweet1NE"
            className="flex justify-center gap-3.5"
          >
            {SOCIALS.map(({ href, label, Icon }) => (
              
             <a   key={label}
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
        </div>
      </section>

      <section className="mx-auto max-w-[34rem] px-[1.15rem] py-[2.8rem] text-center sm:px-6 sm:py-[3.2rem]">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Stay close
        </p>

        <h2 className="mb-3 font-display text-[clamp(1.6rem,4vw,2.3rem)] font-medium leading-tight">
          Know before everyone else.
        </h2>

        <p className="mx-auto mb-7 max-w-[26rem] text-[var(--ivory-dim)]">
          New dishes, event nights and the odd thing we don't put on Instagram.
        </p>

        <NewsletterForm />
      </section>

      <section id="book" className="px-[1.15rem] pb-12 pt-2 text-center sm:px-6">
        <p className="font-display text-[clamp(1.4rem,3vw,2rem)] italic">
          Always in the mood for you.
        </p>
      </section>
    </>
  );
}