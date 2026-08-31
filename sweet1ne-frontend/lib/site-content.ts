/**
 * Content for the marketing site that doesn't live in the database.
 *
 * Branch addresses, hours and photography come from the API — this holds
 * the things a settings page can't: character, perks, transport links, and
 * the signature dishes until they're wired to real menu items.
 */

import type { Dish } from "@/components/site/signature-dishes";

export const SIGNATURE_DISHES: Dish[] = [
  {
    id: "seafood-boil",
    name: "Seafood Boil",
    note: "Serves 2–4 · Poured at the table",
    description:
      "Crab, prawns, mussels and corn, tossed in your choice of sauce and served steaming in the bag.",
    price: "From £45",
    image: "/images/food/seafood-boil.jpg",
  },
  {
    id: "big-chopper",
    name: "The Big Chopper",
    note: "Serves 4 · The one from TikTok",
    description:
      "Lamb chops, oxtail, jollof and mac — the platter people cross London for.",
    price: "£75",
    image: "/images/food/big-chopper.jpg",
  },
  {
    id: "jerk-wings",
    name: "Jerk Wings",
    note: "Serves 1–2",
    description:
      "Marinated overnight, grilled hard, finished with scotch bonnet honey.",
    price: "£12",
    image: "/images/food/jerk-wings.jpg",
  },
  {
    id: "velvet-mojito",
    name: "Velvet Bubblegum Mojito",
    note: "Alcohol-free",
    description: "One of the reasons the room looks like it does on camera.",
    price: "£9",
    image: "/images/food/velvet-mojito.jpg",
  },
];

export type LocationDetail = {
  area: string;
  blurb: string;
  perks: string[];
  mapsUrl: string;
  transport: string[];
  images: string[];
};

/**
 * Keyed by branch slug and merged with the live data from the API.
 *
 * If a branch's slug changes in the database its details silently vanish
 * from the page — nothing errors, it just renders without a blurb. Worth
 * remembering if a location ever looks bare.
 */
export const LOCATION_DETAILS: Record<string, LocationDetail> = {
  lewisham: {
    area: "South East London",
    blurb:
      "Our first proper restaurant, opened in 2023. A room built for the night out people were already making of it — louder after eight, shisha out the back, and the full menu until late.",
    perks: ["Shisha", "Late licence", "Private hire", "Step-free access"],
    mapsUrl: "https://maps.google.com/?q=Sweet1NE+Lewisham",
    transport: ["Lewisham DLR & National Rail", "Bus 21, 136, 208"],
    images: [
      "/images/interiors/lewisham-1.jpg",
      "/images/interiors/lewisham-2.jpg",
      "/images/interiors/lewisham-3.jpg",
    ],
  },
  chingford: {
    area: "East London",
    blurb:
      "The homecoming. Back to East London in 2025, closer to where Sweet1NE started — same kitchen, same standards, a room of its own.",
    perks: ["Private hire", "Kids' menu", "Step-free access"],
    mapsUrl: "https://maps.google.com/?q=Sweet1NE+Chingford",
    transport: ["Chingford Overground", "Bus 97, 179, 212"],
    images: [
      "/images/interiors/chingford-1.jpg",
      "/images/interiors/chingford-2.jpg",
      "/images/interiors/chingford-3.jpg",
    ],
  },
};

export type ContactDetail = {
  name: string;
  area: string;
  address: string[];
  phone: string;
  phoneHref: string;
  email: string;
  mapsUrl: string;
  /** Venue hours, day by day. */
  hours: { days: string; time: string }[];
  /** The kitchen closes before the venue does — worth saying plainly, since
   *  someone arriving late for food needs to know. */
  kitchenNote: string;
  image: string;
};

export const CONTACT_DETAILS: ContactDetail[] = [
  {
    name: "Sweet1NE Lewisham",
    area: "South East London",
    address: ["2 Loampit Hill", "London SE13 7SW"],
    phone: "020 3340 6750",
    phoneHref: "+442033406750",
    email: "info@sweet1ne.com",
    mapsUrl: "https://maps.google.com/?q=2+Loampit+Hill+London+SE13+7SW",
    hours: [
      { days: "Monday – Tuesday", time: "Closed" },
      { days: "Wednesday – Thursday", time: "3pm – 11pm" },
      { days: "Friday – Saturday", time: "1pm – 11pm" },
      { days: "Sunday", time: "1pm – 9pm" },
    ],
    kitchenNote: "Kitchen open until 9.45pm",
    image: "/images/interiors/lewisham-1.jpg",
  },
  {
    name: "Sweet1NE Chingford",
    area: "East London",
    address: ["164 Station Road", "Chingford", "London E4 6AN"],
    phone: "020 3971 3449",
    phoneHref: "+442039713449",
    email: "info@sweet1ne.com",
    mapsUrl: "https://maps.google.com/?q=164+Station+Road+Chingford+London+E4+6AN",
    hours: [
      { days: "Monday – Tuesday", time: "Closed" },
      { days: "Wednesday – Thursday", time: "3pm – 11.45pm" },
      { days: "Friday – Saturday", time: "1pm – 11.45pm" },
      { days: "Sunday", time: "1pm – 11.45pm" },
    ],
    kitchenNote: "Kitchen closes 9.30pm, or 10.30pm Friday and Saturday",
    image: "/images/interiors/chingford-1.jpg",
  },
];