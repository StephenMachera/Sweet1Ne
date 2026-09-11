import type { BranchVideoSources } from "@/components/site/branch-video";

// Every public "Book a table" trigger opens a modal asking which branch,
// then goes straight to that branch's SevenRooms page rather than the
// site's own /reservations page. Keyed to match LOCATIONS' slugs.
export const RESERVATION_URLS: Record<"lewisham" | "chingford", string> = {
  lewisham:
    "https://www.sevenrooms.com/explore/sweet1nerestaurantloungelewisham/reservations/create/search/",
  chingford:
    "https://www.sevenrooms.com/explore/sweet1nerestaurantloungechingfordvenue/reservations/create/search/",
};

export const SOCIAL_LINKS = {
  instagram: "https://www.instagram.com/ssweet1ne/",
  facebook: "https://www.facebook.com/sweet1ne",
  tiktok: "https://www.tiktok.com/@sweet1ne",
};

export type OpeningDay = {
  days: string;
  time: string;
  /** Venue and kitchen close at different times — worth stating, since it's
   *  the detail that saves someone a wasted journey. */
  kitchen?: string;
};

export type Location = {
  slug: string;
  name: string;
  /** For panels and headings — "Lewisham" rather than "Sweet1NE Lewisham". */
  shortName: string;
  area: string;
  /** One line, for cards and panels. */
  address: string;
  /** Split for the locations and contact pages, where it's set as a block. */
  addressLines: string[];
  phone: string;
  phoneHref: string;
  email: string;
  /** Short form for the homepage — the full schedule is in `hours`. */
  hoursSummary: string;
  hours: OpeningDay[];
  perks: string[];
  mapsUrl: string;
  transport: string[];
  blurb: string;
  images: string[];
  opened: string;
  /** Looping background footage for the contact card. Only the branches
   *  that have been filmed carry one — the others keep their photograph. */
  video?: BranchVideoSources;
};

/**
 * The single source for both branches.
 *
 * Every page reads from here — homepage panels, locations, contact — so the
 * addresses and hours can't drift apart between them.
 */
export const LOCATIONS: Location[] = [
  {
    slug: "lewisham",
    name: "Sweet1NE Lewisham",
    shortName: "Lewisham",
    area: "South East London",
    address: "2 Loampit Hill, London SE13 7SW",
    addressLines: ["2 Loampit Hill", "London SE13 7SW"],
    phone: "020 3340 6750",
    phoneHref: "+442033406750",
    email: "info@sweet1ne.com",
    hoursSummary: "Wed–Sun, from midday",
    hours: [
      { days: "Monday – Tuesday", time: "Closed" },
      { days: "Wednesday – Thursday", time: "3pm – 11pm", kitchen: "Kitchen until 9.45pm" },
      { days: "Friday – Saturday", time: "1pm – 11pm", kitchen: "Kitchen until 9.45pm" },
      { days: "Sunday", time: "1pm – 11pm", kitchen: "Kitchen until 9.45pm" },
    ],
    perks: ["Shisha", "Late licence", "Private hire"],
    mapsUrl: "https://maps.google.com/?q=2+Loampit+Hill+London+SE13+7SW",
    transport: ["Lewisham DLR & National Rail", "Bus 21, 136, 208"],
    blurb:
      "Our first proper restaurant, opened in 2023 after three years of building a following. A room made for the night people were already turning it into — louder after eight, shisha out the back, the full menu until late.",
    images: [
      "/images/interiors/lewisham-1.webp",
      "/images/interiors/lewisham-2.webp",
      "/images/interiors/lewisham-3.webp",
    ],
    opened: "2023",
    video: {
      poster: "/images/interiors/lewisham-poster.jpg",
      src: "/videos/lewisham.mp4",
      mobileSrc: "/videos/lewisham-mobile.mp4",
    },
  },
  {
    slug: "chingford",
    name: "Sweet1NE Chingford",
    shortName: "Chingford",
    area: "East London",
    address: "164 Station Road, Chingford, London E4 6AN",
    addressLines: ["164 Station Road", "Chingford", "London E4 6AN"],
    phone: "020 3971 3449",
    phoneHref: "+442039713449",
    email: "info@sweet1ne.com",
    hoursSummary: "Wed–Sun, from midday",
    hours: [
      { days: "Monday – Tuesday", time: "Closed" },
      { days: "Wednesday – Thursday", time: "3pm – 11.45pm", kitchen: "Kitchen until 9.30pm" },
      { days: "Friday – Saturday", time: "1pm – 11.45pm", kitchen: "Kitchen until 10.30pm" },
      { days: "Sunday", time: "1pm – 11.45pm", kitchen: "Kitchen until 9.30pm" },
    ],
    perks: ["Private hire", "Kids' menu", "Step-free access"],
    mapsUrl: "https://maps.google.com/?q=164+Station+Road+Chingford+London+E4+6AN",
    transport: ["Chingford Overground", "Bus 97, 179, 212"],
    blurb:
      "The homecoming — back to East London, closer to where Sweet1NE started. Same kitchen, same standards, a room of its own.",
    images: [
      "/images/interiors/chingford-1.webp",
      "/images/interiors/chingford-2.webp",
      "/images/interiors/chingford-3.webp",
    ],
    opened: "2025",
  },
];