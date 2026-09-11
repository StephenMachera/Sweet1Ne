import type { Metadata } from "next";
import { StoryHero } from "@/components/site/story-hero";
import { StoryOrigin } from "@/components/site/story-origin";
import { StoryRoute } from "@/components/site/story-route";
import { StoryMood } from "@/components/site/story-mood";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "A small table in Fairlop. A lounge in Lewisham. Home again in Chingford. Same kitchen throughout.",
};

export default function StoryPage() {
  return (
    <>
      <StoryHero />
      <StoryOrigin />
      <StoryRoute />
      <StoryMood />
    </>
  );
}