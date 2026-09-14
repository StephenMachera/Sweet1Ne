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
    body: "A small restaurant and takeaway in Ilford. The kitchen that started everything — plates meant to be shared.",
    image: "/images/homepage-gallery/story/vignette-fairlop.jpg",
    alt: "The first room in Fairlop, drawn",
  },
  {
    id: "lewisham",
    kicker: "2023 · Flagship",
    heading: "The flagship.",
    body: "The food had outgrown Fairlop. Lewisham became the flagship restaurant — operating since 2019.",
    image: "/images/homepage-gallery/story/vignette-lewisham.jpg",
    alt: "Lewisham flagship restaurant, drawn — navy booths, blossom, gold slats",
    flip: true,
  },
  {
    id: "chingford",
    kicker: "2025 · Chingford",
    heading: "",
    body: "",
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
          className={`beat py-0 ${beat.flip ? "flip" : ""} ${beat.id === "chingford" ? "is-quiet" : ""}`}
        >
          <div
            className={`story-beat-inner grid w-full items-center gap-0 ${
              beat.id === "chingford"
                ? ""
                : beat.flip
                  ? "lg:grid-cols-[0.8fr_1.2fr]"
                  : "lg:grid-cols-[1.2fr_0.8fr]"
            }`}
          >
            <figure
              className={`story-stage relative z-10 m-0 w-full overflow-hidden bg-[#0a0a0a] ${
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

            <div className={`story-copy px-[1.15rem] py-[1.35rem] sm:px-6 lg:px-[8vw] ${beat.flip ? "lg:order-1" : ""}`}>
              <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--grey)]">
                {beat.kicker}
              </p>

              {beat.heading && (
                <h2 className="mb-3.5 font-display text-[clamp(1.9rem,4vw,3rem)] font-medium leading-[1.12] tracking-[-0.02em]">
                  {beat.heading}
                </h2>
              )}

              {beat.body && <p className="text-[var(--ivory-dim)]">{beat.body}</p>}
            </div>
          </div>
        </article>
      ))}
    </>
  );
}