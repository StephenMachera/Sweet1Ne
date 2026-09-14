import type { Metadata } from "next";
import { StoryJump } from "@/components/site/story-jump";
import { StoryBeats } from "@/components/site/story-beats";
import { StoryCollage } from "@/components/site/story-collage";
import { StoryFollow } from "@/components/site/story-follow";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "A small table in Fairlop. The flagship in Lewisham. Home again in Chingford.",
};

export default function StoryPage() {
  return (
    <div className="story-page bg-black">
      <section className="story-hero hero-copy w-full px-[1.15rem] pb-[1.4rem] pt-[5.6rem] text-left sm:px-8 sm:pt-[6.2rem]">
        <p className="mb-[0.55rem] text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Our story
        </p>

        <h1 className="mb-[0.68rem] max-w-[34rem] font-display text-[clamp(2.2rem,6vw,3.9rem)] font-medium leading-[1.04] tracking-[-0.02em] [text-shadow:none]">
          Our journey <br /> began.
        </h1>

        {/* No forced break: a <br> lands in the wrong place at every width
            but the one it was tuned for. The measure is set in ch so it
            scales with the type, and text-pretty keeps the last line from
            being a lone word. */}
        <p className="max-w-[52ch] text-pretty text-[clamp(0.95rem,0.85rem+0.4vw,1.1rem)] leading-relaxed text-[var(--ivory-dim)]">
          With a passion for bringing people together over dishes that resonate
          with history, culture and heart.
        </p>
      </section>

      <StoryJump />
      <StoryBeats />
      <StoryCollage />
      <StoryFollow />
      <SiteFooter />
    </div>
  );
}