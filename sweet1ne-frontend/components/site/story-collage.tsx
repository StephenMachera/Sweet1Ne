"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Tile = {
  id: string;
  frames: string[];
  /** Where it sits in the grid — the tiles are deliberately unequal. */
  area: string;
  aspect: string;
};

const TILES: Tile[] = [
  {
    id: "people",
    area: "row-span-2",
    aspect: "",
    frames: [
      "/images/homepage-gallery/story/collage-people-table.jpg",
      "/images/homepage-gallery/story/collage-people-open.jpg",
      "/images/homepage-gallery/story/collage-people-booth.jpg",
      "/images/homepage-gallery/story/collage-people-close.jpg",
    ],
  },
  {
    id: "food",
    area: "",
    aspect: "",
    frames: [
      "/images/homepage-gallery/menu/photo-pasta.jpg",
      "/images/homepage-gallery/order/emblem-aways.jpg",
      "/images/homepage-gallery/menu/photo-starters.jpg",
      "/images/homepage-gallery/web-2560x1440/07-seafood.jpg",
    ],
  },
  {
    id: "drink",
    area: "",
    aspect: "",
    frames: [
      "/images/homepage-gallery/menu/photo-bar-globe.jpg",
      "/images/homepage-gallery/menu/photo-bar-rose.jpg",
      "/images/homepage-gallery/menu/photo-bar-umbrellas.jpg",
    ],
  },
  {
    id: "kitchen",
    area: "",
    aspect: "",
    frames: [
      "/images/homepage-gallery/menu/photo-chef.jpg",
      "/images/homepage-gallery/menu/photo-boil-lemon.jpg",
    ],
  },
  {
    id: "share",
    area: "",
    aspect: "",
    frames: [
      "/images/homepage-gallery/story/collage-share.jpg",
      "/images/homepage-gallery/menu/photo-boil-table.jpg",
      "/images/homepage-gallery/web-2560x1440/02-lamb-chops.jpg",
    ],
  },
];

/**
 * The table as it is now — a collage that keeps moving.
 *
 * Each tile cycles at its own interval and starts after its own delay, so
 * they drift apart rather than changing together. Synchronised, it would
 * read as a slideshow; staggered, it reads as a room.
 */
export function StoryCollage() {
  return (
    <section
      aria-label="The table now"
      className="story-now w-full py-[2.6rem]"
    >
      <p className="mb-4 px-[1.15rem] text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)] sm:px-6">
        The table now
      </p>

      <p className="sr-only">
        A cycling collage of the kitchen, the plates, and people at the table.
      </p>

      <div className="story-collage grid grid-cols-[1.15fr_0.85fr_0.85fr] grid-rows-[minmax(14rem,34svh)_minmax(14rem,34svh)] gap-[5px] bg-black max-[720px]:grid-cols-2 max-[720px]:grid-rows-none">
        {TILES.map((tile, i) => (
          <CyclingTile key={tile.id} tile={tile} index={i} />
        ))}
      </div>
    </section>
  );
}

function CyclingTile({ tile, index }: { tile: Tile; index: number }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (tile.frames.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // The index decides both the delay before starting and the interval —
    // so no two tiles ever change on the same beat.
    const interval = 3800 + index * 540;
    const delay = 700 + index * 820;

    let timer: ReturnType<typeof setInterval>;

    const start = setTimeout(() => {
      timer = setInterval(() => {
        setFrame((current) => (current + 1) % tile.frames.length);
      }, interval);
    }, delay);

    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [tile.frames.length, index]);

  return (
    <div
      className={`story-tile relative overflow-hidden bg-[#0a0a0a] ${tile.area} ${tile.aspect} ${
        tile.id === "people"
          ? "max-[720px]:col-span-full max-[720px]:row-auto max-[720px]:h-[42svh] max-[720px]:min-h-[14rem]"
          : "max-[720px]:h-[28svh] max-[720px]:min-h-[11rem]"
      }`}
    >
      {tile.frames.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes={
            tile.id === "people"
              ? "(max-width: 720px) 100vw, 41vw"
              : "(max-width: 720px) 50vw, 30vw"
          }
          quality={100}
          unoptimized={tile.id === "people"}
          className={`object-cover transition-opacity duration-[1100ms] ease-in-out ${
            i === frame ? "opacity-100" : "opacity-0"
          } ${
            tile.id === "people"
              ? "object-[50%_38%]"
              : tile.id === "food"
                ? "object-[50%_50%]"
                : tile.id === "drink"
                  ? "object-[50%_40%]"
                  : tile.id === "kitchen"
                    ? "object-[38%_42%]"
                    : "object-[50%_62%]"
          }`}
        />
      ))}
    </div>
  );
}