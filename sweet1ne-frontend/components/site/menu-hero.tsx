import Image from "next/image";
import Link from "next/link";

/**
 * Split on desktop — copy on the left, the image on the right, with the
 * background bleeding into it. Full-bleed with a veil on mobile.
 */
export function MenuHero() {
  return (
    <section className="relative grid h-[100svh] overflow-hidden bg-black lg:grid-cols-[minmax(22rem,0.88fr)_1.12fr] lg:grid-rows-1">
      <div className="absolute inset-0 lg:relative lg:inset-auto lg:col-start-2 lg:row-start-1 lg:h-full lg:min-h-0">
        <Image
          src="/images/homepage-gallery/menu/photo-chef.jpg"
          alt="Chef finishing lamb at Sweet1NE"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[64%_28%] lg:object-[62%_18%]"
        />

        {/* On desktop the background fades into the image from the left,
            so there's no hard seam between copy and photograph. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden lg:block"
          style={{
            background:
              "linear-gradient(to right, #0e0e0e 0%, transparent 22%)",
          }}
        />

        {/* On mobile the copy sits on the image, so it needs a veil. */}
        <span
          aria-hidden
          className="absolute inset-0 lg:hidden"
          style={{
            background:
              "linear-gradient(to top, rgba(5,5,5,.92) 0%, rgba(5,5,5,.18) 46%, rgba(5,5,5,.4) 100%)",
          }}
        />
      </div>

      <div className="relative z-[1] max-w-[38rem] self-end px-[1.15rem] pb-[2.2rem] sm:px-6 lg:col-start-1 lg:row-start-1 lg:max-w-[28rem] lg:self-center lg:px-8 lg:pb-8 lg:pt-22">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Lewisham · Chingford
        </p>

        <h1
          className="mb-3.5 font-display text-[clamp(2.6rem,7vw,4.6rem)] font-medium leading-[1.02] tracking-[-0.02em]"
          style={{ textShadow: "0 2px 18px rgba(0,0,0,.65)" }}
        >
          The table.
        </h1>

        <p className="mb-5 max-w-[26rem] text-[var(--ivory-dim)]">
          Elevated Afro-Fusion. African and Caribbean dishes, with the
          indulgence of soul food.
        </p>

        <Link
          href="#starters"
          className="border-b border-[rgba(201,162,74,.7)] pb-[0.12rem] text-[0.78rem] uppercase tracking-[0.12em] text-[var(--ivory)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
        >
          The kitchen
        </Link>
      </div>
    </section>
  );
}