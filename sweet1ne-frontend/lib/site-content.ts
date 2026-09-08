import type { Dish } from "@/components/site/signature-dishes";

// Every public "Book a table" link goes straight to SevenRooms rather than
// the site's own /reservations page.
export const RESERVATION_URL =
  "https://www.sevenrooms.com/explore/sweet1nerestaurantloungechingfordvenue/reservations/create/search/";

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
      { days: "Sunday", time: "1pm – 9pm", kitchen: "Kitchen until 9.45pm" },
    ],
    perks: ["Shisha", "Late licence", "Private hire"],
    mapsUrl: "https://maps.google.com/?q=2+Loampit+Hill+London+SE13+7SW",
    transport: ["Lewisham DLR & National Rail", "Bus 21, 136, 208"],
    blurb:
      "Our first proper restaurant, opened in 2023 after three years of building a following. A room made for the night people were already turning it into — louder after eight, shisha out the back, the full menu until late.",
    images: [
      "/images/interiors/lewisham-1.jpg",
      "/images/interiors/lewisham-2.jpg",
      "/images/interiors/lewisham-3.jpg",
    ],
    opened: "2023",
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
      "/images/interiors/chingford-1.jpg",
      "/images/interiors/chingford-2.jpg",
      "/images/interiors/chingford-3.jpg",
    ],
    opened: "2025",
  },
];