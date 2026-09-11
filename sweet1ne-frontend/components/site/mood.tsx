import Image from "next/image";
import Link from "next/link";

/**
 * The closing note — the mark, and one thing to do.
 *
 * Deliberately almost empty after everything above it. The logo is large,
 * there's a single button, and nothing else competes.
 */
export function Mood() {
  return (
    <section className="px-5 pb-[6.25rem] pt-[5.5rem] text-center sm:px-6">
      {/* Not fill — the mark keeps its own proportions and sits at a size
          relative to the viewport, capped so it doesn't dominate on a wide
          screen. */}
      <div className="mx-auto mb-8 w-[min(78vw,26rem)]">
        <Image
          src="/images/homepage-gallery/story/logo.png"
          alt="Sweet1NE"
          width={416}
          height={416}
          className="h-auto w-full"
          style={{ filter: "drop-shadow(0 18px 40px rgba(0,0,0,.45))" }}
        />
      </div>

      <Link
        href="/reservations"
        className="inline-block bg-[var(--gold)] px-[1.6rem] py-[0.95rem] text-[0.85rem] font-semibold text-[#0e0e0e] transition-opacity hover:opacity-90"
        style={{ borderRadius: "4px" }}
      >
        Book a table
      </Link>
    </section>
  );
}