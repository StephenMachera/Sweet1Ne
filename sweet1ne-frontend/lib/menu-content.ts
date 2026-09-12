/**
 * The menu, as eight chapters.
 *
 * A placeholder while the real items go into the database. Organised
 * differently from the PDF — salads sit with starters, sides and sauces are
 * one chapter, and everything drinkable is "the bar".
 */

export type Dish = {
  name: string;
  price?: string;
  description?: string;
  /** One dish per chapter gets a circular photograph and the full width. */
  featured?: boolean;
  image?: string;
};

export type Chapter = {
  id: string;
  kicker: string;
  heading: string;
  lede?: string;
  /** Sides and Kids have no emblem — they're short sections. */
  mark?: string;
  /** How the mark and the course disc are framed. Circular crops are
   *  unforgiving, so most need nudging. */
  markPosition?: string;
  /** A full-width band above the list. */
  bleed?: { src: string; alt: string };
  /** Three portrait shots above the list. */
  shots?: string[];
  dishes: Dish[];
};

const PHOTO = "/images/homepage-gallery/menu";

export const MENU: Chapter[] = [
  {
    id: "starters",
    kicker: "Starters",
    heading: "The first bite.",
    lede: "Small plates. Afro-Caribbean heat, London table.",
    mark: `${PHOTO}/photo-starters.jpg`,
    markPosition: "48% 38%",
    dishes: [
      {
        name: "Baobun Duo — Prawns or Oxtail",
        price: "£11.50",
        description:
          "Steamed buns. Crispy tempura prawns or slow-braised oxtail, hoisin, pickled slaw.",
        featured: true,
        image: `${PHOTO}/photo-starters.jpg`,
      },
      {
        name: "Crab Croquettes, Pepper Emulsion",
        price: "£9.50",
        description: "Golden crab and potato, roasted pepper sauce.",
      },
      { name: "Crispy Calamari", price: "£9.00", description: "Light batter, house dip, lemon." },
      {
        name: "Jollof Sushi Roll",
        price: "£10.50",
        description:
          "Jollof rice, salmon and plantain or vegetables. Salmon £10.50 · Veg £9.50",
      },
      {
        name: "Tempura Prawns",
        price: "£9.50",
        description: "Seasoned batter, sweet chilli, spring onion.",
      },
      {
        name: "Sweet1ne Street Tacos — Chicken or Beef",
        price: "£11.50",
        description: "Jerk chicken or smoky beef, salsa, avocado mousse.",
      },
      {
        name: "Wings — Spicy or BBQ",
        price: "£8.00",
        description: "Spicy rub or house-smoked BBQ.",
      },
      {
        name: "Charred Garlic Bread, Herb Butter",
        price: "£4.50",
        description: "Toasted baguette, garlic and parsley butter.",
      },
      {
        name: "Oxtail Bruschetta, Basil Crème",
        price: "£9.50",
        description: "Shredded oxtail on sourdough, whipped basil crème.",
      },
      {
        name: "Curry Goat Spring Rolls, Scotch Bonnet Drizzle",
        price: "£9.50",
        description: "Hand-rolled, sweet chilli and Scotch bonnet.",
      },
      {
        name: "Mini Asun Sliders, Charred Tomato Jam",
        price: "£9.50",
        description: "Smoked goat in brioche, tomato and pepper jam.",
      },
      {
        name: "Grilled Tiger Prawn Skewers, Citrus Herb Oil",
        price: "£9.50",
        description: "Garlic, lime and coriander, chargrilled.",
      },
      {
        name: "Roasted Sweetcorn Velouté",
        price: "£8.50",
        description: "Smoked paprika oil, garlic bread.",
      },
      {
        name: "Confit Duck, Kale & Pomegranate",
        price: "£16.50",
        description: "Salad. Raspberry–plum gastrique.",
      },
      {
        name: "Sweet1ne Garden Salad",
        price: "£11.50",
        description: "Seasonal greens, avocado, citrus-mustard.",
      },
    ],
  },
  {
    id: "mains",
    kicker: "Mains",
    heading: "The plate you came for.",
    lede: "Comfort, charcoal, and the kitchen's own sauces.",
    mark: `${PHOTO}/photo-mains.jpg`,
    markPosition: "50% 48%",
    dishes: [
      {
        name: "Lamb Cutlets, Plantain Mash",
        price: "£23.00",
        description:
          "Charcoal-grilled. Plantain mash or mashed potato, sauce of your choosing.",
        featured: true,
        image: `${PHOTO}/photo-mains.jpg`,
      },
      {
        name: "Seared Loch Duart Salmon",
        price: "£22.00",
        description: "Baby potatoes, greens, citrus beurre blanc.",
      },
      {
        name: "9oz Dry-Aged Ribeye",
        price: "£19.00",
        description: "Grilled vegetables, roast garlic jus.",
      },
      {
        name: "24K 9oz Ribeye & Lobster",
        price: "£100.00",
        description: "Gold-leaf ribeye, lobster tail, two large sides.",
      },
      {
        name: "Surf & Turf",
        price: "£47.00",
        description: "9oz steak, lobster tail, garlic-herb butter.",
      },
      {
        name: "The Big Chopper Feast",
        price: "£39.00",
        description:
          "Mac & cheese, lamb chops or oxtail, wings or chicken, rice, plantain, slaw.",
      },
      {
        name: "Grilled Giant Prawns",
        price: "£22.50",
        description: "Shell-on, house glaze, lemon.",
      },
      { name: "Oxtail", price: "£22.50", description: "Slow-braised. Rice or roti." },
      {
        name: "Curry Goat",
        price: "£23.50",
        description: "Scotch bonnet, thyme, allspice. Rice or roti.",
      },
      {
        name: "Sweet Jerk BBQ Chicken",
        price: "£18.50",
        description: "Steamed rice and coleslaw.",
      },
      {
        name: "Beef Burger with Fries",
        price: "£14.50",
        description: "Brioche, house sauce, slaw.",
      },
      {
        name: "Vegan Burger with Fries",
        price: "£12.50",
        description: "Avocado, slaw, herb mayo.",
      },
    ],
  },
  {
    id: "pasta",
    kicker: "Pasta",
    heading: "Jerk in the cream.",
    lede: "Rasta pasta — the kitchen's own fusion, not for show.",
    mark: `${PHOTO}/photo-pasta.jpg`,
    markPosition: "50% 46%",
    dishes: [
      {
        name: "Rasta Pasta — Jerk Chicken",
        price: "£18.50",
        description: "Creamy penne, peppers, jerk chicken, garlic bread.",
        featured: true,
        image: `${PHOTO}/photo-pasta.jpg`,
      },
      {
        name: "Lobster Tail Pasta",
        price: "£35.50",
        description: "Jerk-spiced cream, micro coriander.",
      },
      {
        name: "Chef's Special — Prawns & Chicken",
        price: "£28.00",
        description: "Prawns, jerk chicken, smoked turkey sausage.",
      },
      {
        name: "Seafood Linguine",
        price: "£28.00",
        description: "Mussels, prawns, crab, roasted tomato.",
      },
      {
        name: "Rasta Pasta — Vegan",
        price: "£14.50",
        description: "Same bold flavours, plant-based.",
      },
    ],
  },
  {
    id: "seafood",
    kicker: "Seafood",
    heading: "From the grill, for the table.",
    lede: "Prawns, lobster, a boil if the night is sharing.",
    mark: `${PHOTO}/photo-seafood.jpg`,
    markPosition: "48% 55%",
    bleed: {
      src: `${PHOTO}/photo-boil-table.jpg`,
      alt: "Sweet1ne loaded seafood boil",
    },
    dishes: [
      {
        name: "Sweet1ne Loaded Seafood Boil",
        price: "£74.99",
        description:
          "Snow crab, lobster, jumbo prawns, mussels, sausage, potatoes, corn, eggs. Cajun garlic butter. For sharing.",
        featured: true,
        image: `${PHOTO}/photo-boil-lemon.jpg`,
      },
      {
        name: "Grilled Giant Prawns",
        price: "£22.50",
        description: "Chargrilled, house sauce, lemon.",
      },
      {
        name: "Build your boil",
        price: "—",
        description:
          "Snow crab or lobster £22 · Jumbo prawns or mussels £10.50 · Sausage, potato or corn £5 · Eggs £3",
      },
    ],
  },
  {
    id: "sides",
    kicker: "Sides & sauces",
    heading: "What sits with it.",
    dishes: [
      { name: "Rasta Pasta", price: "£12.50" },
      {
        name: "Cheesy Oxtail Dumpling",
        price: "£11.50",
        description: "Add mac & cheese £3",
      },
      { name: "Mac & Cheese", price: "£8.00", description: "Regular £8 · Crab £11.50" },
      { name: "Seafood Rice", price: "£10.50" },
      { name: "Loaded Fries", price: "£11.50" },
      { name: "Jollof Rice", price: "£6.00", description: "Small £6 · Large £8" },
      { name: "Rice & Peas", price: "£6.00", description: "Small £6 · Large £8" },
      { name: "Creamy Mashed Potatoes", price: "£8.00" },
      { name: "Country Corn — Cajun or Garlic Butter", price: "£6.00" },
      { name: "Sautéed Broccoli", price: "£6.00" },
      { name: "Steamed Rice", price: "£6.00" },
      { name: "Noodles", price: "£4.00" },
      { name: "Plantain or Fries", price: "£5.00" },
      { name: "Spicy Green Herb Sauce", price: "£4.00" },
      { name: "Calm-Cas Red Coriander (VG)", price: "£3.00" },
      { name: "Sweet Steph Garlic Butter", price: "£5.00" },
      { name: "Big T Jerk BBQ", price: "£4.00" },
      { name: "Sweet1ne House Sauce", price: "£3.00" },
      { name: "Sweet1ne Cajun Sauce", price: "£5.00", description: "Mild or hot" },
      { name: "Garlic Butter", price: "£4.00" },
    ],
  },
  {
    id: "kids",
    kicker: "Kids",
    heading: "For the young ones.",
    dishes: [
      { name: "Mac 'n' Cheese", price: "£4.00" },
      { name: "BBQ Wings & Fries", price: "£7.50" },
      { name: "Beef Burger & Fries", price: "£8.50" },
    ],
  },
  {
    id: "desserts",
    kicker: "Desserts",
    heading: "Something sweet.",
    lede: "West African dough, yaji spice, rum toffee.",
    mark: `${PHOTO}/photo-desserts.jpg`,
    markPosition: "40% 58%",
    dishes: [
      {
        name: "Yaji Cinnamon French Toast",
        price: "£9.00",
        description: "Brioche, yaji and cinnamon, zobo berry sauce.",
        featured: true,
        image: `${PHOTO}/photo-desserts.jpg`,
      },
      {
        name: "Rum Sticky Toffee Pudding",
        price: "£12.50",
        description: "Dark rum toffee, Madagascan vanilla ice cream.",
      },
      { name: "Cheesecake", price: "£11.50", description: "Oreo Crumble or Lotus Biscoff." },
      { name: "Apple Crumble", price: "£10.50", description: "Custard or ice cream." },
      {
        name: "Salted Caramel Puff Puff",
        price: "£10.50",
        description: "West African dough, white chocolate cream.",
      },
      {
        name: "Ice Cream",
        price: "from £7",
        description: "Oreo £7 · Vanilla £8 · Strawberry £8 · Alphonso mango £10",
      },
    ],
  },
  {
    id: "bar",
    kicker: "The bar",
    heading: "A proper bar for the table.",
    lede: "Cocktails, wine, something without alcohol if you'd rather.",
    mark: `${PHOTO}/photo-bar-globe.jpg`,
    markPosition: "50% 36%",
    shots: [
      `${PHOTO}/photo-bar-globe.jpg`,
      `${PHOTO}/photo-bar-umbrellas.jpg`,
      `${PHOTO}/photo-bar-rose.jpg`,
    ],
    dishes: [
      {
        name: "Exotic Pina Colada",
        price: "£13.00",
        featured: true,
        image: `${PHOTO}/photo-bar-globe.jpg`,
      },
      { name: "Velvet Bubblegum Mojito", price: "£13.00" },
      { name: "Sweet1ne Special", price: "£13.00" },
      { name: "Inferno Spicy Margarita", price: "£13.00" },
      { name: "Moonlight Mojito", price: "£13.00" },
      { name: "Midnight Pornstar Martini", price: "£13.00" },
      { name: "Temptress Martini", price: "£13.00" },
      { name: "Luscious Strawberry Daiquiri", price: "£13.00" },
      { name: "Tahitian Mai Tai", price: "£13.00" },
      { name: "Long Island Blur", price: "£13.00" },
      { name: "Margarita Fiesta", price: "£13.00" },
      { name: "Sapphire Blue Lagoon", price: "£13.00" },
      { name: "Rum Punch", price: "£11.00" },
      { name: "Pineapple Punch", price: "£9.00" },
      { name: "Guinness Punch", price: "£9.00" },
      { name: "Midair Carousel", price: "£30.00", description: "Shared between four." },
      { name: "Wine — Rosé, White or Red", price: "£25.00" },
      { name: "Prosecco", price: "£35.00" },
      { name: "Belaire Rosé", price: "£90.00" },
      { name: "Moët Brut", price: "£120.00" },
      { name: "Nigerian Fanta", price: "£6.50" },
      { name: "Supermalt", price: "£4.00" },
      { name: "Juice", price: "£3.00", description: "Apple · Orange" },
      { name: "Water", price: "from £3", description: "Small £3 · Large £6" },
      {
        name: "Spirits",
        price: "from £80",
        description:
          "Azul, Casamigos, Hennessy, Courvoisier, Cîroc, Grey Goose, house tequila — ask the room.",
      },
    ],
  },
];

export const MENU_NOTE =
  "Tell your server about allergies before you order. Not every ingredient is listed. Confirm in the room if you need to.";

/** The six that get an emblem in the course rail. */
export const COURSES = ["starters", "mains", "pasta", "seafood", "desserts", "bar"];