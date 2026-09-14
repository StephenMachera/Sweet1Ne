import Image from "next/image";
import Link from "next/link";

/**
 * Split on desktop — copy left, image right, with the background bleeding
 * into the photograph. Full-bleed with a veil on mobile.
 */
export function MenuHero() {
  return (
    <section className="hero">
      <div className="hero-frame">
        <Image
          className="hero-media"
          src="/images/homepage-gallery/menu/photo-chef.jpg"
          alt="Chef finishing lamb at Sweet1NE"
          fill
          priority
          sizes="100vw"
        />

        {/* On desktop the background fades into the image from the left, so
            there's no hard seam between copy and photograph. */}
        <span
          aria-hidden
          className="hero-desktop-fade"
        />

        {/* On mobile the copy sits on the image, so it needs a veil. */}
        <span
          aria-hidden
          className="hero-veil"
        />
      </div>

      <div className="hero-copy">
        <h1>
          The Menu.
        </h1>

        <p className="dek">
          Elevated Afro-Fusion. African and Caribbean dishes, with the
          indulgence of soul food.
        </p>

        <Link
          href="#starters"
          className="ghost"
        >
          The kitchen
        </Link>
      </div>
    </section>
  );
}