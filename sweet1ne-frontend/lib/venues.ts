/**
 * The two restaurants, as the Find Us page needs them.
 *
 * Separate from LOCATIONS in site-content, which the contact page uses —
 * these hours are per-day with kitchen times, which that shape can't hold.
 */

export type Venue = {
  id: string;
  name: string;
  kicker: string;
  tagline: string;
  address: string;
  phone: string;
  phoneHref: string;
  mapsUrl: string;
  hours: { days: string; time: string }[];
  chips: string[];
  transport: string;
  image: string;
  alt: string;
};

export const VENUES: Venue[] = [
  {
    id: "lewisham",
    name: "Lewisham",
    kicker: "Flagship · South East London",
    tagline: "The flagship. Operating since 2019.",
    address: "2 Loampit Hill, London SE13 7SW",
    phone: "020 3340 6750",
    phoneHref: "+442033406750",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Sweet1NE+2+Loampit+Hill+London+SE13+7SW",
    hours: [
      { days: "Mon–Tue", time: "Closed" },
      { days: "Wed–Thu", time: "3pm–11pm · kitchen until 9.45pm" },
      { days: "Fri–Sat", time: "1pm–11pm · kitchen until 9.45pm" },
      { days: "Sunday", time: "1pm–11pm · kitchen until 9.45pm" },
    ],
    chips: ["Kids' menu", "Private hire"],
    transport: "Lewisham DLR & National Rail · Bus 21, 136, 208",
    image: "/images/homepage-gallery/interiors/lewisham-room.jpg",
    alt: "Sweet1NE Lewisham — navy booths, blossom, gold slats",
  },
  {
    id: "chingford",
    name: "Chingford",
    kicker: "East London",
    tagline: "A room of its own.",
    address: "164 Station Road, Chingford, London E4 6AN",
    phone: "020 3971 3449",
    phoneHref: "+442039713449",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Sweet1NE+164+Station+Road+Chingford+London+E4+6AN",
    hours: [
      { days: "Mon–Tue", time: "Closed" },
      { days: "Wed–Thu", time: "3pm–11.45pm · kitchen until 9.30pm" },
      { days: "Fri–Sat", time: "1pm–11.45pm · kitchen until 10.30pm" },
      { days: "Sunday", time: "1pm–11.45pm · kitchen until 9.30pm" },
    ],
    chips: ["Shisha", "Kids' menu", "Private hire"],
    transport: "Chingford Overground · Bus 97, 179, 212",
    image: "/images/homepage-gallery/interiors/chingford-room.jpg",
    alt: "Sweet1NE Chingford — neon cranes, navy booths, blossom",
  },
];