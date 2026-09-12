import Image from "next/image";

type Beat = {
  id: string;
  kicker: string;
  heading: string;
  body: string;
  image: string;
  alt: string;
  /** Copy first rather than the image — they alternate down the page. */
  flip?: boolean;
};

const BEATS: Beat[] = [
  {
    id: "fairlop",
    kicker: "2019 · Fairlop",
    heading: "The first table.",
    body: "A small restaurant and takeaway in Ilford. The kitchen that started everything — plates meant to be shared, a room that wasn't yet the flagship.",
    image: "/images/homepage-gallery/story/vignette-fairlop.jpg",
    alt: "The first room in Fairlop, drawn",
  },
  {
    id: "lewisham",
    kicker: "2023 · Flagship",
    heading: "The flagship.",
    body: "The food had outgrown the first room. Lewisham became the flagship restaurant — operating since 2019. A table for people you actually want to eat with.",
    image: "/images/homepage-gallery/story/vignette-lewisham.jpg",
    alt: "Lewisham flagship restaurant, drawn — navy booths, blossom, gold slats",
    flip: true,
  },
  {
    id: "chingford",
    kicker: "2025 · Chingford",
    heading: "Closer to home.",
    body: "East London again. A second room, nearer where it began. Circular mirrors, a peach banquette, teal chairs. The path was never a straight line.",
    image: "/images/homepage-gallery/story/vignette-chingford.jpg",
    alt: "Chingford room, drawn — teal chairs, circular mirrors",
  },
];

/**
 * The three rooms. Images alternate sides down the page, each in an
 * outlined frame — the outline sits outside the element without affecting
 * layout, which is how the gold rule floats clear of the picture.
 */
export function StoryBeats() {
  return (
    <>
      {BEATS.map((beat) => (
        <article
          key={beat.id}
          id={beat.id}
          data-stop={beat.id}
          className="py-0"
        >
          <div
            className={`grid w-full items-center gap-0 ${
              beat.flip ? "lg:grid-cols-[0.8fr_1.2fr]" : "lg:grid-cols-[1.2fr_0.8fr]"
            }`}
          >
            <figure
              className={`relative z-10 m-0 aspect-[20/9] w-full bg-[#161412] ${
                beat.flip ? "lg:order-2" : ""
              }`}
            >
              <Image
                src={beat.image}
                alt={beat.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </figure>

            <div className={`px-[1.15rem] sm:px-6 lg:px-[8vw] ${beat.flip ? "lg:order-1" : ""}`}>
              <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
                {beat.kicker}
              </p>

              <h2 className="mb-3.5 font-display text-[clamp(1.9rem,4vw,3rem)] font-medium leading-[1.12] tracking-[-0.02em]">
                {beat.heading}
              </h2>

              <p className="text-[var(--ivory-dim)]">{beat.body}</p>
            </div>
          </div>
        </article>
      ))}
    </>
  );
}