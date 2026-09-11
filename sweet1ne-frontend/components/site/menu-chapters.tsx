"use client";

import Image from "next/image";
import { openBookingModal } from "./booking-modal";
import { MENU, MENU_NOTE, type Chapter, type Dish } from "@/lib/menu-content";

/**
 * The menu, chapter by chapter.
 *
 * Two columns on desktop, one on mobile. A featured dish per chapter spans
 * the full width with a circular photograph — the only imagery among the
 * items, which is what makes it read as a highlight rather than a gallery.
 */
export function MenuChapters() {
  return (
    <>
      <MenuChapter chapter={MENU[0]} />

      {/* An invitation between the first two chapters, so the page pauses
          before the mains rather than running straight through. */}
      <div className="px-[1.15rem] pb-5 pt-11 text-center sm:px-6">
        <p className="mb-4 font-display text-[1.35rem]">
          The list is the invitation. The table is the night.
        </p>
        <BookButton />
      </div>

      {MENU.slice(1, 4).map((chapter) => (
        <MenuChapter key={chapter.id} chapter={chapter} />
      ))}

      <div className="px-[1.15rem] pb-5 pt-11 text-center sm:px-6">
        <BookButton />
      </div>

      {MENU.slice(4).map((chapter) => (
        <MenuChapter key={chapter.id} chapter={chapter} />
      ))}

      <p className="mx-auto max-w-[1100px] px-[1.15rem] pb-12 text-[0.82rem] text-[var(--ivory-dim)] sm:px-6">
        {MENU_NOTE}
      </p>
      {MENU.slice(4).map((chapter) => (
        <MenuChapter key={chapter.id} chapter={chapter} />
      ))}

      <p className="mx-auto max-w-[1100px] px-[1.15rem] pb-12 text-[0.82rem] text-[var(--ivory-dim)] sm:px-6">
        {MENU_NOTE}
      </p>

      {/* A last nudge before the mark. */}
      <div className="px-[1.15rem] pb-5 pt-11 text-center sm:px-6">
        <p className="mb-4 font-display text-[1.35rem]">
          Lewisham or Chingford. Same kitchen.
        </p>
        <BookButton />
      </div>

      {/* The closing mark — quiet, and one thing to do. */}
      <section className="px-[1.15rem] pb-[5.5rem] pt-20 text-center sm:px-6">
        <div className="mx-auto mb-7 w-[min(72vw,22rem)]">
          <Image
            src="/images/homepage-gallery/story/logo.png"
            alt="Sweet1NE"
            width={352}
            height={352}
            className="h-auto w-full"
          />
        </div>

        <p className="mx-auto mb-6 max-w-[24rem] text-[var(--ivory-dim)]">
          The table is set. Your night is next.
        </p>

        <BookButton />
      </section>
    </>
  );
}

function BookButton() {
  return (
    <button
      type="button"
      onClick={openBookingModal}
      className="inline-block bg-[var(--gold)] px-[1.2rem] py-[0.7rem] text-[0.85rem] font-semibold text-[#0e0e0e] transition-opacity hover:opacity-90"
      style={{ borderRadius: "4px" }}
    >
      Book a table
    </button>
  );
}

function MenuChapter({ chapter }: { chapter: Chapter }) {
  return (
    <section
      id={chapter.id}
      // scroll-mt clears the fixed header and the sticky course nav when an
      // anchor lands.
      className="relative mx-auto max-w-[1100px] scroll-mt-[10.5rem] px-[1.15rem] pb-4 pt-10 sm:px-6 sm:pb-6 sm:pt-14 sm:scroll-mt-[11rem]"
    >
      <div
        className={`mb-8 grid items-center gap-5 ${
          chapter.mark ? "md:grid-cols-[9.2rem_1fr] md:gap-8" : ""
        }`}
      >
        {chapter.mark && (
          <div
            className="relative aspect-square w-[6.6rem] rounded-full sm:w-[9.2rem]"
            style={{
              boxShadow: "0 0 0 2px var(--gold), 0 0 0 10px rgba(14,14,14,.92)",
            }}
          >
            {/* A second ring set outside the first — subtle, and it's what
                makes the mark feel placed rather than pasted. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-4 rounded-full border border-[rgba(201,162,74,.2)]"
            />
            <Image
              src={chapter.mark}
              alt=""
              fill
              sizes="(max-width: 720px) 106px, 147px"
              className="rounded-full object-cover"
            />
          </div>
        )}

        <div>
          <p className="mb-2.5 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
            {chapter.kicker}
          </p>

          <h2 className="mb-2 font-display text-[clamp(2rem,4vw,3.1rem)] font-medium leading-tight">
            {chapter.heading}
          </h2>

          {chapter.lede && (
            <p className="max-w-[34rem] text-[var(--ivory-dim)]">{chapter.lede}</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 lg:gap-x-10">
        {chapter.dishes.map((dish) => (
          <DishRow key={dish.name} dish={dish} />
        ))}
      </div>
    </section>
  );
}

function DishRow({ dish }: { dish: Dish }) {
  if (dish.featured && dish.image) {
    return (
      <article className="grid grid-cols-[4.4rem_1fr_auto] items-center gap-x-[1.1rem] gap-y-4 border-b border-[rgba(229,226,225,.08)] py-[1.05rem] sm:grid-cols-[5.6rem_1fr_auto] lg:col-span-2">
        <div
          className="relative h-[4.4rem] w-[4.4rem] shrink-0 overflow-hidden rounded-full sm:h-[5.6rem] sm:w-[5.6rem]"
          style={{ boxShadow: "0 0 0 1px rgba(201,162,74,.4)" }}
        >
          <Image
            src={dish.image}
            alt={dish.name}
            fill
            sizes="90px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0">
          <h3 className="font-display text-[1.18rem] font-medium leading-snug">
            {dish.name}
          </h3>
          {dish.description && (
            <p className="mt-1 text-[0.9rem] text-[var(--ivory-dim)]">
              {dish.description}
            </p>
          )}
        </div>

        {dish.price && (
          <p className="whitespace-nowrap font-display text-[1.05rem] text-[var(--gold)]">
            {dish.price}
          </p>
        )}
      </article>
    );
  }

  return (
    <article className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-b border-[rgba(229,226,225,.08)] py-[1.05rem]">
      <div className="min-w-0">
        <h3 className="font-display text-[1.18rem] font-medium leading-snug">
          {dish.name}
        </h3>
        {dish.description && (
          <p className="mt-1 text-[0.9rem] text-[var(--ivory-dim)]">
            {dish.description}
          </p>
        )}
      </div>

      {dish.price && (
        <p className="whitespace-nowrap font-display text-[1.05rem] text-[var(--gold)]">
          {dish.price}
        </p>
      )}
    </article>
  );
}