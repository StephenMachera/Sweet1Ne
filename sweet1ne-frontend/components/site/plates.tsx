import Image from "next/image";

const PLATES = [
  { src: "/images/homepage-gallery/carousel/web/02-prawn-pasta.jpg", label: "Prawn Rasta Pasta" },
  { src: "/images/homepage-gallery/carousel/web/08-boil-lemon.jpg", label: "Seafood Boil" },
  { src: "/images/homepage-gallery/carousel/web/03-lamb.jpg", label: "Lamb Cutlets" },
  { src: "/images/homepage-gallery/carousel/web/04-bao.jpg", label: "Bao Buns" },
  { src: "/images/homepage-gallery/carousel/web/06-stew.jpg", label: "Curry Goat" },
  { src: "/images/homepage-gallery/carousel/web/05-prawns.jpg", label: "Lobster" },
  { src: "/images/homepage-gallery/carousel/web/07-spring-rolls.jpg", label: "Curry Goat Spring Rolls" },
];

/**
 * The table, then the plates drifting past.
 *
 * The rail holds the dishes twice: translating -50% lands the duplicate
 * exactly where the original began, so the loop has no seam. The second set
 * is hidden from screen readers, which shouldn't hear everything twice.
 */
export function Plates() {
  return (
    <>
      <section aria-label="The plates" className="pb-[2.6rem] pt-[0.6rem]">
        <figure className="mx-auto mb-[1.8rem] max-w-[46rem] scroll-mt-20 px-5">
          <div
            className="relative aspect-[3/2] overflow-hidden bg-[#111]"
            style={{ boxShadow: "0 0 0 1px rgba(201,162,74,.75)" }}
          >
            <Image
              src="/images/homepage-gallery/carousel/web/01-table.jpg"
              alt="The table at Sweet1NE"
              fill
              sizes="(max-width: 736px) 100vw, 736px"
              className="object-cover object-[50%_48%]"
            />
          </div>
        </figure>

        {/* The mask fades both ends, so dishes arrive and leave rather than
            appearing at a hard edge. */}
        <div
          className="overflow-hidden pb-[0.4rem] pt-[0.2rem]"
          style={{
            maskImage:
              "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
          }}
        >
          <div className="plate-rail flex w-max gap-[1.15rem] px-5 pb-[1.1rem] pt-[0.4rem]">
            {/* Twice through — the second set is what makes the loop
                seamless. */}
            {[...PLATES, ...PLATES].map((plate, i) => (
              <figure
                key={`${plate.src}-${i}`}
                aria-hidden={i >= PLATES.length}
                className="m-0 w-[min(58vw,196px)] shrink-0 text-center text-[var(--ivory-dim)] sm:w-[min(42vw,210px)]"
              >
                <div
                  className="relative mx-auto mb-[0.7rem] aspect-square w-full overflow-hidden rounded-full bg-[#111]"
                  style={{
                    boxShadow:
                      "0 0 0 2px rgba(201,162,74,.85), 0 0 0 6px #050505, 0 0 0 7px rgba(201,162,74,.35)",
                  }}
                >
                  <Image
                    src={plate.src}
                    alt=""
                    fill
                    sizes="(max-width: 720px) 196px, 210px"
                    className="object-cover"
                  />
                </div>

                {/* A minimum height so captions of one and three words don't
                    leave the discs sitting at different heights. */}
                <figcaption className="min-h-[2.6em] text-[0.62rem] uppercase leading-[1.35] tracking-[0.12em]">
                  {plate.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-12 pt-2 text-center sm:px-6">
        <p className="font-display text-[clamp(1.4rem,3vw,2rem)] italic">
          Always in the mood for you.
        </p>
      </section>
    </>
  );
}