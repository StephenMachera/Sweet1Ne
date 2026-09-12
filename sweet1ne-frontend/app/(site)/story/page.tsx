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
    <div className="story-page">
      <section className="story-hero w-full px-[1.15rem] pb-[1.4rem] pt-[5.6rem] text-left sm:px-8 sm:pt-[6.2rem]">
        <p className="mb-[0.55rem] text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Our story
        </p>

        <h1 className="mb-[0.65rem] max-w-[34rem] font-display text-[clamp(2.2rem,6vw,3.9rem)] font-medium leading-[1.04] tracking-[-0.02em]">
          Same kitchen.
          <br />
          The rooms grew.
        </h1>

        <p className="max-w-[40rem] text-[1.02rem] text-[var(--ivory-dim)]">
          A small table in Fairlop. The flagship in Lewisham. Home again in
          Chingford.
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