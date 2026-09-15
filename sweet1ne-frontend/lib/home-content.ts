export type NavLink = { label: string; href: string };

export const NAV_LINKS: NavLink[] = [
  { label: "Menu", href: "/menu" },
  { label: "Order", href: "/order" },
  { label: "Our Story", href: "/story" },
  { label: "Events", href: "/events" },
  { label: "Find Us", href: "/locations" },
  { label: "Contact", href: "/contact" },
];

export type Plate = { src: string; caption: string };

export const PLATES: Plate[] = [
  { src: "/images/homepage-gallery/carousel/web/02-prawn-pasta.jpg", caption: "Prawn Rasta Pasta" },
  { src: "/images/homepage-gallery/carousel/web/08-boil-lemon.jpg", caption: "Seafood Boil" },
  { src: "/images/homepage-gallery/carousel/web/03-lamb.jpg", caption: "Lamb Cutlets" },
  { src: "/images/homepage-gallery/carousel/web/04-bao.jpg", caption: "Bao Buns" },
  { src: "/images/homepage-gallery/carousel/web/06-stew.jpg", caption: "Curry Goat" },
  { src: "/images/homepage-gallery/carousel/web/05-prawns.jpg", caption: "Lobster" },
  { src: "/images/homepage-gallery/carousel/web/07-spring-rolls.jpg", caption: "Curry Goat Spring Rolls" },
];

export type Beat = {
  id: string;
  sources: { src: string; poster: string; only?: "desktop" | "phone"; objectPosition: string; preload: "auto" | "metadata" | "none" }[];
};

export const BEATS: Beat[] = [
  {
    id: "night",
    sources: [
      {
        src: "/images/homepage-gallery/videos/film-events.mp4",
        poster: "/images/homepage-gallery/events/poster-events.jpg",
        objectPosition: "50% 16%",
        preload: "auto",
      },
    ],
  },
  {
    id: "room",
    sources: [
      {
        src: "/images/homepage-gallery/videos/film-chingford.mp4",
        poster: "/images/homepage-gallery/cinematic/poster-chingford-open.jpg",
        only: "desktop",
        objectPosition: "58% center",
        preload: "metadata",
      },
      {
        src: "/images/homepage-gallery/videos/film-chingford-mobile.mp4",
        poster: "/images/homepage-gallery/cinematic/poster-chingford-open.jpg",
        only: "phone",
        objectPosition: "58% center",
        preload: "none",
      },
    ],
  },
];