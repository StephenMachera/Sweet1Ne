/**
 * The close — larger social marks than the footer's, since here they're the
 * point rather than a formality.
 */
export function StoryFollow() {
  return (
    <>
      <section className="story-follow mx-auto max-w-[62rem] px-[1.15rem] py-[2.8rem] text-center sm:px-8 sm:py-[3.2rem]">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          And so the journey continues
        </p>

        <h2 className="mb-3.5 font-display text-[clamp(1.9rem,4vw,3rem)] font-medium leading-tight tracking-[-0.02em]">
          Follow along.
        </h2>

        <p className="mx-auto mb-[1.35rem] max-w-[28rem] text-[var(--ivory-dim)]">
          The rooms grew. The kitchen stayed. Come sit — then keep the table
          with us.
        </p>
      </section>

      <section className="px-[1.15rem] pb-4 pt-0 text-center sm:px-6">
        <p className="font-display text-[clamp(1.4rem,3vw,2rem)] italic">
          Always in the mood for you.
        </p>
      </section>
    </>
  );
}