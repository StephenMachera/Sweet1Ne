"use client";

import Image from "next/image";
import Link from "next/link";
import { openBookingModal } from "./booking-modal";
import { SiteFooter } from "./site-footer";
import { MENU, MENU_NOTE, type Chapter, type Dish } from "@/lib/menu-content";

export function MenuChapters() {
  return (
    <>
      <MenuChapter chapter={MENU[0]} />

      {/* A pause between the first two chapters, so the page doesn't run
          straight from starters into mains. */}
      <p className="px-[1.15rem] pb-1.5 pt-9 text-center font-display text-[1.25rem] italic sm:px-6">
        The list is the invitation. The table is the night.
      </p>

      {MENU.slice(1).map((chapter) => (
        <MenuChapter key={chapter.id} chapter={chapter} />
      ))}

      <p className="mx-auto max-w-[1100px] px-[1.15rem] pb-8 pt-6 text-[0.82rem] text-[var(--ivory-dim)] sm:px-6">
        {MENU_NOTE}
      </p>

      {/* The closing invitation — centred, with room above and below. */}
      <section
        id="book"
        className="border-b border-[rgba(229,226,225,.08)] px-[1.15rem] pb-20 pt-14 text-center sm:px-6 sm:pb-24 sm:pt-16"
      >
        <p className="mb-6 font-display text-[clamp(1.4rem,3vw,2rem)] italic leading-tight">
          Always in the mood for you.
        </p>

        <button
          type="button"
          onClick={openBookingModal}
          className="inline-block border border-[rgba(201,162,74,.9)] px-[1.15rem] py-[0.65rem] text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--gold)] transition-colors hover:bg-[var(--gold)] hover:text-[#0e0e0e]"
          style={{ borderRadius: "3px" }}
        >
          Book a table
        </button>
      </section>
      <SiteFooter />
    </>
  );
}

function MenuChapter({ chapter }: { chapter: Chapter }) {
  return (
    <section
      id={chapter.id}
      // Clears the fixed header and the sticky course rail when an anchor
      // lands.
      className="mx-auto max-w-[1100px] scroll-mt-[12.2rem] px-[1.15rem] pb-4 pt-9 sm:px-6 sm:pb-5 sm:pt-[3.2rem] sm:scroll-mt-[13rem]"
    >
      <div
        className={`mb-6 grid items-center gap-5 ${
          chapter.mark ? "md:grid-cols-[8.6rem_1fr] md:gap-8" : ""
        }`}
      >
        {chapter.mark && (
          <div
            className="relative aspect-square w-[6.4rem] overflow-hidden rounded-full sm:w-[8.6rem]"
            style={{ boxShadow: "0 0 0 2px var(--gold)" }}
          >
            <Image
              src={chapter.mark}
              alt=""
              fill
              sizes="(max-width: 720px) 102px, 138px"
              className="object-cover"
              style={
                chapter.markPosition
                  ? { objectPosition: chapter.markPosition }
                  : undefined
              }
            />
          </div>
        )}

        <div>
          <p className="mb-2.5 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
            {chapter.kicker}
          </p>

          <h2 className="mb-2 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-tight tracking-[-0.02em]">
            {chapter.heading}
          </h2>

          {chapter.lede && (
            <p className="max-w-[34rem] text-[var(--ivory-dim)]">{chapter.lede}</p>
          )}
        </div>
      </div>

      {/* A full-width band — used where one image says more than a list can. */}
      {chapter.bleed && (
        <figure className="mb-6 max-h-[18rem] overflow-hidden sm:max-h-[28rem]">
          <div className="relative h-[18rem] w-full sm:h-[28rem]">
            <Image
              src={chapter.bleed.src}
              alt={chapter.bleed.alt}
              fill
              sizes="100vw"
              className="object-cover"
            />
          </div>
        </figure>
      )}

      {/* Three portraits — for a chapter where the drinks are the look. */}
      {chapter.shots && (
        <div aria-hidden className="mb-6 grid grid-cols-3 gap-[0.35rem] sm:gap-[0.55rem]">
          {chapter.shots.map((src) => (
            <div key={src} className="relative aspect-[3/4] w-full">
              <Image
                src={src}
                alt=""
                fill
                sizes="33vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

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
          <Image src={dish.image} alt={dish.name} fill sizes="90px" className="object-cover" />
        </div>

        <div className="min-w-0">
          <h3 className="font-display text-[1.15rem] font-medium leading-snug">
            {dish.name}
          </h3>
          {dish.description && (
            <p className="mt-1 text-[0.9rem] text-[var(--ivory-dim)]">{dish.description}</p>
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
        <h3 className="font-display text-[1.15rem] font-medium leading-snug">{dish.name}</h3>
        {dish.description && (
          <p className="mt-1 text-[0.9rem] text-[var(--ivory-dim)]">{dish.description}</p>
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