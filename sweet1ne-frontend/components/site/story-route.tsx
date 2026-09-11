import Image from "next/image";

type Beat = {
  id: string;
  kicker: string;
  heading: string;
  body: string;
  image: string;
  alt: string;
  /** Where the image sits relative to the copy, and how it's nudged. */
  layout: "default" | "flip" | "home";
};

const BEATS: Beat[] = [
  {
    id: "fairlop",
    kicker: "2019 · Fairlop",
    heading: "The first table.",
    body: "A small restaurant and takeaway in Ilford. The kitchen that started everything — plates meant to be shared, a room that wasn't yet a lounge. Elevated Afro-Fusion, from a few seats.",
    image: "/images/homepage-gallery/story/vignette-fairlop.jpg",
    alt: "The first room in Fairlop, drawn",
    layout: "default",
  },
  {
    id: "lewisham",
    kicker: "2023 · Lewisham",
    heading: "Somewhere to sit properly.",
    body: "The food had outgrown the first room. Lewisham gave it a lounge — gold slats, a circular mirror, blossom, navy velvet. A table for people you actually want to eat with.",
    image: "/images/homepage-gallery/story/vignette-lewisham.jpg",
    alt: "Lewisham drawn from the real room — gold slats, blossom, navy booth",
    layout: "flip",
  },
  {
    id: "chingford",
    kicker: "2025 · Chingford",
    heading: "Closer to home.",
    body: "East London again. Same kitchen. Same standard. A second room, nearer where it began — circular mirrors, a peach banquette, teal chairs. The path was never a straight line.",
    image: "/images/homepage-gallery/story/vignette-chingford.jpg",
    alt: "Chingford drawn from the real room — circular mirrors, peach banquette, teal chairs",
    layout: "home",
  },
];

/**
 * Three rooms, three years, with a dashed line wandering between them.
 *
 * The spine is the point — a straight rule would read as a timeline, where
 * this meanders. "The path was never a straight line" is in the copy, and
 * the drawing says it before the words do.
 *
 * Each beat is rotated a degree or so off-axis, which is what stops them
 * looking like a grid.
 */
export function StoryRoute() {
  return (
    <div className="relative mx-auto max-w-[1120px] py-8 pl-[1.65rem] pr-[1.15rem] sm:px-6 sm:pb-8 sm:pt-12">
      {/* Down the left on mobile, through the middle on desktop. */}
      <svg
        viewBox="0 0 140 1200"
        preserveAspectRatio="none"
        aria-hidden
        className="pointer-events-none absolute bottom-8 left-[1.1rem] top-4 z-0 block w-6 lg:bottom-16 lg:left-1/2 lg:top-16 lg:w-[140px] lg:-translate-x-1/2"
      >
        <path
          d="M70 0 C 20 140, 120 220, 70 360 S 10 520, 80 680 S 130 860, 60 1040"
          fill="none"
          stroke="#c9a24a"
          strokeWidth="1.5"
          strokeDasharray="4 10"
          opacity="0.85"
        />
      </svg>

      {BEATS.map((beat) => (
        <BeatBlock key={beat.id} beat={beat} />
      ))}
    </div>
  );
}

function BeatBlock({ beat }: { beat: Beat }) {
  // The column split differs per beat, and the flipped one puts its copy
  // first — so the images alternate sides down the page.
  const grid = {
    default: "lg:grid-cols-[1.05fr_0.95fr]",
    flip: "lg:grid-cols-[0.9fr_1.1fr]",
    home: "lg:grid-cols-[1.2fr_0.8fr] lg:ml-[4%]",
  }[beat.layout];

  // A degree of rotation, only on desktop — on a phone it would just look
  // like a mistake.
  const tilt = {
    default: "",
    flip: "lg:-rotate-[1.2deg]",
    home: "lg:rotate-[1deg] lg:translate-y-6",
  }[beat.layout];

  return (
    <article
      id={beat.id}
      className={`relative z-[1] mb-13 grid items-center gap-7 scroll-mt-24 sm:mb-[5.5rem] lg:gap-14 ${grid}`}
    >
      <figure
        className={`m-0 bg-[#161412] outline outline-1 outline-offset-4 outline-[var(--gold)] transition-transform sm:outline-offset-[7px] ${tilt}`}
      >
        <Image
          src={beat.image}
          alt={beat.alt}
          width={900}
          height={675}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="h-auto w-full"
        />
      </figure>

      <div className={beat.layout === "flip" ? "lg:order-first" : ""}>
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          {beat.kicker}
        </p>

        <h2 className="mb-3.5 font-display text-[clamp(2rem,4vw,3.1rem)] font-medium leading-[1.12]">
          {beat.heading}
        </h2>

        <p className="text-[var(--ivory-dim)]">{beat.body}</p>
      </div>
    </article>
  );
}