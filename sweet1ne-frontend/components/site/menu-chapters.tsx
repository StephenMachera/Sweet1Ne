"use client";

import Image from "next/image";
import Slogan from "@/components/site/slogan";
import { SiteFooter } from "./site-footer";
import { MENU, MENU_NOTE, type Chapter, type Dish } from "@/lib/menu-content";

export function MenuChapters() {
  return (
    <>
      {MENU.map((chapter) => (
        <MenuChapter key={chapter.id} chapter={chapter} />
      ))}

      <p className="note">
        {MENU_NOTE}
      </p>

      {/* The closing invitation — centred, with room above and below. */}
      <Slogan />
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
      className="chapter"
    >
      <div
        className={`chapter-head ${chapter.mark ? "has-mark" : ""}`}
      >
        {chapter.mark && (
          <div
            className="chapter-mark"
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
          {chapter.heading ? (
            <>
              <p className="kicker">{chapter.kicker}</p>
              <h2>{chapter.heading}</h2>
              {chapter.lede && <p className="lede">{chapter.lede}</p>}
            </>
          ) : (
            // Mains, Pasta, Seafood carry only the word — set as the
            // heading, in the kicker's face.
            <h2 className="kicker">{chapter.kicker}</h2>
          )}
        </div>
      </div>

      {/* A full-width band — used where one image says more than a list can. */}
      {chapter.bleed && (
        <figure className="bleed">
          <div>
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
        <div aria-hidden className="shots">
          {chapter.shots.map((src) => (
            <div key={src}>
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

      <div className="list">
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
      <article className="dish is-feat">
        <div
          className="dish-image"
        >
          <Image src={dish.image} alt={dish.name} fill sizes="90px" className="object-cover" />
        </div>

        <div>
          <h3>
            {dish.name}
          </h3>
          {dish.description && (
            <p>{dish.description}</p>
          )}
        </div>

        {dish.price && (
          <p className="price">
            {dish.price}
          </p>
        )}
      </article>
    );
  }

  return (
    <article className="dish">
      <div>
        <h3>{dish.name}</h3>
        {dish.description && (
          <p>{dish.description}</p>
        )}
      </div>

      {dish.price && (
        <p className="price">
          {dish.price}
        </p>
      )}
    </article>
  );
}