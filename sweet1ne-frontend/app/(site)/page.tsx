import type { Metadata } from "next";
import { FilmDeck } from "@/components/site/film-deck";

export const metadata: Metadata = {
  title: {
    absolute: "Sweet1NE — Lewisham & Chingford",
  },
  description: "Always in the mood for you. Lewisham and Chingford.",
};

export default function HomePage() {
  return <FilmDeck />;
}