import type { Metadata } from "next";
import { MenuHero } from "@/components/site/menu-hero";
import { CourseNav } from "@/components/site/course-nav";
import { MenuChapters } from "@/components/site/menu-chapters";

export const metadata: Metadata = {
  title: "Menu",
  description: "The Sweet1NE menu. Book Lewisham or Chingford.",
};

export default function MenuPage() {
  return (
    <div className="menu-page">
      <MenuHero />
      <CourseNav />
      <MenuChapters />
    </div>
  );
}