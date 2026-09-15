import { PLATES } from "@/lib/home-content";

export default function Plates() {
  const loop = [...PLATES, ...PLATES];

  return (
    <section className="pb-[2.6rem] pt-[0.6rem]" aria-label="The plates">
      <figure className="mx-auto mb-[1.8rem] max-w-[46rem] px-5 text-center text-[var(--ivory-dim)] [scroll-margin-top:5rem]">
        <div className="aspect-[3/2] overflow-hidden bg-[#111] [box-shadow:0_0_0_1px_rgba(201,162,74,0.75)]">
          <img
            src="/images/homepage-gallery/carousel/web/01-table.jpg"
            alt="The table at Sweet1NE"
            className="h-full w-full object-cover [object-position:50%_48%]"
          />
        </div>
      </figure>

      <div className="overflow-hidden pb-[0.4rem] pt-[0.2rem]
        [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]
        [-webkit-mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
        <div className="flex w-max animate-rail gap-[1.15rem] px-5 pb-[1.1rem] pt-[0.4rem] hover:[animation-play-state:paused] motion-reduce:animate-none">
          {loop.map((plate, i) => (
            <figure
              key={`${plate.src}-${i}`}
              aria-hidden={i >= PLATES.length}
              className="m-0 w-[min(58vw,196px)] flex-none text-center text-[var(--ivory-dim)] sm:w-[min(42vw,210px)]"
            >
              <div className="mx-auto mb-[0.7rem] aspect-square w-full overflow-hidden rounded-full bg-[#111]
                [box-shadow:0_0_0_2px_rgba(201,162,74,0.85),0_0_0_6px_#050505,0_0_0_7px_rgba(201,162,74,0.35)]">
                <img src={plate.src} alt="" className="h-full w-full object-cover" />
              </div>
              <figcaption className="min-h-[2.6em] text-[0.62rem] uppercase leading-[1.35] tracking-[0.12em]">
                {plate.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}