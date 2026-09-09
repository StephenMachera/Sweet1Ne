/**
 * The full à la carte menu, transcribed from the PDF.
 *
 * A placeholder while the real menu data goes into the database — this page
 * replaces the live /menu, and swaps back when items and photography are in.
 *
 * Several items don't fit a simple name-and-price shape: some have two
 * prices for two sizes, some are a heading with a priced list beneath, some
 * are a choice between named options. Rather than force everything into one
 * structure, an item carries whichever of these it needs.
 */

export type MenuItem = {
  name: string;
  /** Absent where the item is a heading for the options beneath it. */
  price?: string;
  description?: string;
  /** "Small or Large 6 / 8", "Mild or Hot" — a choice, not a description. */
  variant?: string;
  /** Named sub-options, each with their own description. */
  choices?: { name: string; description?: string }[];
  /** A priced grid beneath the item — boil components, ice cream flavours. */
  options?: { name: string; price: string }[];
  /** Parenthetical extras, e.g. "add on mac and cheese 3". */
  note?: string;
};

export type MenuCategory = {
  id: string;
  name: string;
  tagline?: string;
  items: MenuItem[];
  /** Food sections get imagery and generous spacing; drinks are price lists
   *  and read better tight. */
  kind: "food" | "drink";
  image?: string;
};

export const MENU_INTRO = {
  heading: "Welcome",
  paragraphs: [
    "At Sweet1ne, we've elevated our menu to new heights, offering an exquisite reinvention of flavors with truly stunning plate presentation, where every ingredient tells a story. Our aim is to deliver the highest quality authentic dishes, stirring all five senses of our guests who dine and lounge with us. Escape the everyday and feed your taste buds as you indulge in our menu of exquisite flavors, carefully curated by our talented executive chef and team.",
    "We're bringing decades of continental culinary experience, with new and exciting ways to reinterpret traditional African, Caribbean, and American soul dishes in a contemporary way. We also offer a tantalizing array of freshly made seafood dishes. And let's not forget our beautifully handcrafted desserts!",
    "Explore our menu options below—we're sure you'll find something that catches your eye.",
  ],
  allergens:
    "Please always inform your server of any allergies or intolerances before placing your order. Not all ingredients are listed on the menu, and we cannot guarantee the total absence of allergens.",
};

export const MENU: MenuCategory[] = [
  {
    id: "starters",
    name: "Starters",
    kind: "food",
    image: "/images/menu/starters.jpg",
    tagline:
      "A refined selection of small plates inspired by traditional African and Caribbean fusions, reimagined through a modern London lens.",
    items: [
      {
        name: "Baobun Duo — Prawns or Oxtail",
        price: "11.50",
        description:
          "Steamed Asian-style buns filled with either crispy tempura prawns or slow-braised oxtail with a hoisin reduction and pickled slaw.",
      },
      {
        name: "Crab Croquettes, Pepper Emulsion",
        price: "9.5",
        description:
          "Golden-crusted croquettes filled with seasoned crab and potato, served with a smooth roasted pepper sauce.",
      },
      {
        name: "Crispy Calamari",
        price: "9",
        description:
          "Lightly battered squid rings with any house dip, side salad with fresh lemon wedge.",
      },
      {
        name: "Jollof Sushi Roll",
        variant: "Salmon 10.5 · Veg 9.5",
        description:
          "Fusion roll of seasoned jollof rice and seaweed, filled with grilled salmon and tropical plantain or seasonal vegetables, served with a fiery tomato dip or soy sauce.",
      },
      {
        name: "Tempura Prawns",
        price: "9.5",
        description:
          "Crisp-fried prawns in a seasoned batter, glazed with a sweet chili dip topped with spring onions.",
      },
      {
        name: "Sweet1ne Street Tacos — Chicken or Beef",
        price: "11.5",
        description:
          "Crispy mini tortillas filled with jerk marinated chicken or smoky beef, garnished with fresh salsa and avocado mousse.",
      },
      {
        name: "Wings — Spicy or BBQ",
        price: "8",
        description:
          "Choice of spicy rub or house-smoked BBQ, finished with chili flakes and micro herbs.",
      },
      {
        name: "Charred Garlic Bread, Herb Butter",
        price: "4.5",
        description:
          "Toasted baguette brushed with garlic and parsley butter, perfect for sharing or pairing.",
      },
      {
        name: "Oxtail Bruschetta, Basil Crème",
        price: "9.5",
        description:
          "Slow-braised oxtail delicately shredded and layered over toasted sourdough, finished with a whipped basil crème sauce.",
      },
      {
        name: "Curry Goat Spring Rolls, Scotch Bonnet Drizzle",
        price: "9.5",
        description:
          "Caribbean-spiced goat encased in handrolled pastry, served crisp with a sweet chilli & Scotch bonnet dipping sauce.",
      },
      {
        name: "Mini Asun Sliders, Charred Tomato Jam",
        price: "9.5",
        description:
          "Smoked goat legs, fire-roasted and handpulled, nestled in soft brioche buns with a slow-cooked tomato and pepper jam.",
      },
      {
        name: "Grilled Tiger Prawn Skewers, Citrus Herb Oil",
        price: "9.5",
        description:
          "Sustainably-sourced tiger prawns marinated in garlic, lime and coriander, skewered and chargrilled to order.",
      },
      {
        name: "Roasted Sweetcorn Velouté",
        price: "8.5",
        description:
          "Velvety corn soup with a touch of spice smoked paprika oil, served with crispy garlic bread.",
      },
    ],
  },
  {
    id: "salads",
    name: "Salads",
    kind: "food",
    image: "/images/menu/salads.jpg",
    tagline: "Bold, vibrant compositions designed to refresh and invigorate.",
    items: [
      {
        name: "Confit Duck, Kale & Pomegranate Salad",
        price: "16.5",
        description:
          "Shredded duck leg confit, paired with massaged kale, pomegranate arils, toasted seeds, and a raspberry–plum gastrique.",
      },
      {
        name: "Sweet1ne Garden Salad",
        price: "11.5",
        description:
          "Crisp seasonal greens with ribbons of carrot, smashed avocado, crispy leeks, and a tangy citrus-mustard dressing.",
      },
    ],
  },
  {
    id: "mains",
    name: "Mains",
    kind: "food",
    image: "/images/menu/mains.jpg",
    tagline:
      "Signature plates combining classic comfort with refined execution and bold cultural identity.",
    items: [
      {
        name: "Seared Loch Duart Salmon, Baby Potatoes & Greens",
        price: "22",
        description:
          "Crisp-skinned Scottish salmon, served with sautéed greens, heritage baby potatoes and a citrus beurre blanc.",
      },
      {
        name: "9oz Dry-Aged Ribeye, Grilled Vegetables, Roast Garlic Jus",
        price: "19",
        description:
          "Grass-fed ribeye grilled to preference, paired with seasonal veg and a sauce of your choosing.",
      },
      {
        name: "24K 9oz Ribeye & Lobster",
        price: "100",
        description:
          "A show-stopping 24-carat gold leaf–gilded ribeye steak paired with grilled lobster tail, served with two large sides.",
      },
      {
        name: "Surf & Turf",
        price: "47",
        description:
          "Succulent 9oz steak paired with lobster tail, finished with a garlic-herb butter and citrus jus.",
      },
      {
        name: "The Big Chopper Feast",
        price: "39",
        description:
          "A grand platter of mac & cheese, grilled lamb chops or oxtail, wings or diced chicken breast, with rice, sweet plantain, and house slaw.",
      },
      {
        name: "Grilled Giant Prawns",
        price: "22.5",
        description:
          "Shell-on succulent prawns chargrilled and glazed in our rich house sauce served with a lemon wedge.",
      },
      {
        name: "Lamb Cutlets, Plantain Mash / Mashed Potatoes",
        price: "23",
        description:
          "Charcoal grilled lamb cutlets with mashed sweet plantain or mash potatoes and sauce of choice.",
      },
      {
        name: "Oxtail",
        price: "22.5",
        description:
          "Slow-braised oxtail in a rich gravy, served with your choice of rice or roti.",
      },
      {
        name: "Curry Goat",
        price: "23.5",
        description:
          "Tender goat in a Caribbean curry sauce with scotch bonnet, thyme and allspice, served with your choice of rice or roti.",
      },
      {
        name: "Sweet Jerk BBQ Chicken",
        price: "18.5",
        description:
          "Grilled chicken glazed in our Sweet1ne jerk BBQ sauce, served with steamed rice & coleslaw.",
      },
      {
        name: "Beef Burger with Fries",
        price: "14.5",
        description:
          "Chargrilled beef patty in a brioche bun, topped with lettuce, house sauce and coleslaw.",
      },
      {
        name: "Vegan Burger with Fries",
        price: "12.5",
        description:
          "Plant-based burger with smashed avocado, slaw, Sweet1ne herb mayo and coleslaw.",
      },
    ],
  },
  {
    id: "pasta",
    name: "Pasta Specials",
    kind: "food",
    image: "/images/menu/pasta.jpg",
    items: [
      {
        name: "Rasta Pasta — Jerk Chicken",
        price: "18.5",
        description:
          "Creamy penne tossed with mixed peppers and tender jerk chicken breast, served with toasted garlic bread.",
      },
      {
        name: "Lobster Tail Pasta",
        price: "35.5",
        description:
          "Buttery lobster tail on a bed of creamy jerk-spiced pasta, garnished with micro coriander and a lemon slice.",
      },
      {
        name: "Chef's Special Rasta Pasta — Prawns & Chicken",
        price: "28",
        description:
          "The ultimate combo: grilled prawns and jerk chicken breast, smoked turkey sausage over peppery cream pasta.",
      },
      {
        name: "Seafood Linguine",
        price: "28",
        description:
          "Roasted cherry tomato, basil and cream cheese base tossed with mussels, prawns, shredded crab, finished with garlic oil and parsley.",
      },
      {
        name: "Rasta Pasta — Vegan Option",
        price: "14.50",
        description: "Same bold flavours, reimagined plantbased.",
      },
    ],
  },
  {
    id: "seafood-boil",
    name: "Seafood Boil Experience",
    kind: "food",
    image: "/images/menu/seafood-boil.jpg",
    tagline: "A share-worthy indulgence — seasoned, steamy, and sensational.",
    items: [
      {
        name: "Sweet1ne Loaded Seafood Boil",
        price: "74.99",
        description:
          "A feast of snow crab legs, lobster tail, jumbo prawns, green mussels, chicken & turkey sausages, sweet potatoes, corn on the cob, and eggs, served in our signature Cajun garlic butter sauce.",
      },
      {
        name: "Create Your Own Boil Combo",
        description:
          "Build your own seafood platter with your choice of shellfish, sausage, and sides. Add on rice or noodles to soak up the flavour.",
        options: [
          { name: "Snow Crab Legs", price: "22" },
          { name: "Lobster Tail", price: "22" },
          { name: "Jumbo Prawns", price: "10.5" },
          { name: "Green Mussels", price: "10.5" },
          { name: "Chicken & Turkey Sausages", price: "5" },
          { name: "Sweet / White Potatoes", price: "5" },
          { name: "Corn on the Cob", price: "5" },
          { name: "Eggs", price: "3" },
        ],
      },
    ],
  },
  {
    id: "sides",
    name: "Sides",
    kind: "food",
    image: "/images/menu/sides.jpg",
    tagline: "Perfect complements to your main course.",
    items: [
      { name: "Rasta Pasta", price: "12.5" },
      {
        name: "Cheesy Oxtail Dumpling",
        price: "11.5",
        note: "Add on mac and cheese 3",
      },
      { name: "Mac & Cheese", variant: "Regular 8 · Crab 11.5" },
      { name: "Seafood Rice", price: "10.5" },
      { name: "Loaded Fries", price: "11.5" },
      { name: "Jollof Rice", variant: "Small 6 · Large 8" },
      { name: "Rice & Peas", variant: "Small 6 · Large 8" },
      { name: "Creamy Mashed Potatoes", price: "8" },
      { name: "Country Corn — Cajun or Garlic Butter", price: "6" },
      { name: "Sauteed Broccoli", price: "6" },
      { name: "Steamed Rice", price: "6" },
      { name: "Noodles", price: "4" },
      { name: "Plantain or Fries", price: "5" },
    ],
  },
  {
    id: "sauces",
    name: "House Sauces",
    kind: "food",
    image: "/images/menu/sauces.jpg",
    tagline:
      "Available with mains or on request — crafted in-house for balance and boldness.",
    items: [
      {
        name: "Spicy Green Herb Sauce",
        price: "4",
        description: "Vibrant, punchy, and herbaceous.",
      },
      {
        name: "Calm-Cas Red Coriander (VG)",
        price: "3",
        description: "Smooth tomato base with toasted coriander and red pepper.",
      },
      {
        name: "Sweet Steph Garlic Butter",
        price: "5",
        description: "Rich, silky, and indulgent with roasted garlic and parsley.",
      },
      {
        name: "Big T Jerk BBQ",
        price: "4",
        description: "Smoked molasses and allspice with a bold jerk kick.",
      },
      {
        name: "Sweet1ne House Sauce",
        price: "3",
        description: "Signature burger dressing with depth, sweetness, and umami.",
      },
      { name: "Sweet1ne Cajun Sauce", price: "5", variant: "Mild or Hot" },
      {
        name: "Garlic Butter",
        price: "4",
        description: "Velvety and aromatic.",
      },
    ],
  },
  {
    id: "kids",
    name: "Kids Menu",
    kind: "food",
    image: "/images/menu/kids.jpg",
    tagline: "For the young foodies.",
    items: [
      { name: "Mac 'n' Cheese", price: "4" },
      { name: "BBQ Wings & Fries", price: "7.5" },
      { name: "Beef Burger & Fries", price: "8.5" },
    ],
  },
  {
    id: "desserts",
    name: "Desserts",
    kind: "food",
    image: "/images/menu/desserts.jpg",
    tagline: "Comforting classics, lovingly elevated for indulgent moments.",
    items: [
      {
        name: "Rum Sticky Toffee Pudding",
        price: "12.50",
        description:
          "A rich date sponge soaked in dark rum toffee sauce, served warm with Madagascan vanilla ice cream.",
      },
      {
        name: "Cheesecake Selection",
        price: "11.50",
        description: "Your choice of:",
        choices: [
          { name: "Oreo Crumble", description: "Creamy, chocolate indulgence." },
          {
            name: "Lotus Biscoff",
            description: "Spiced caramel perfection with a biscuit crunch.",
          },
        ],
      },
      {
        name: "Apple Crumble",
        price: "10.50",
        description:
          "Spiced stewed apples with a golden oat topping, served with warm vanilla custard or a scoop of your chosen ice cream.",
      },
      {
        name: "Salted Caramel Puff Puff",
        price: "10.50",
        description:
          "West African dough fritters drizzled with salted caramel, finished with white chocolate cream and milk chocolate shavings.",
      },
      {
        name: "Yaji Cinnamon French Toast",
        price: "9",
        description:
          "Brioche slices infused with warm yaji spice and cinnamon, paired with a tangy zobo berry sauce.",
      },
      {
        name: "Ice Cream Selection",
        variant: "Per scoop",
        description: "Hand-churned and flavour-forward.",
        options: [
          { name: "Oreo Crumble", price: "7" },
          { name: "Madagascan Vanilla", price: "8" },
          { name: "Alphonso Mango", price: "10" },
          { name: "Wild Strawberry", price: "8" },
        ],
      },
    ],
  },
  {
    id: "cocktails",
    name: "Cocktails",
    kind: "drink",
    image: "/images/menu/cocktails.jpg",
    items: [
      { name: "Midair Carouse", price: "30", note: "Shared between 4" },
      { name: "Sweet1ne Special", price: "13" },
      { name: "Velvet Bubblegum Mojito", price: "13" },
      { name: "Inferno Spicy Margarita", price: "13" },
      { name: "Long Island Blur", price: "13" },
      { name: "Luscious Strawberry Daiquiri", price: "13" },
      { name: "Tahitian Mai Tai", price: "13" },
      { name: "Exotic Pina Colada", price: "13" },
      { name: "Moonlight Mojito", price: "13" },
      { name: "Midnight Pornstar Martini", price: "13" },
      { name: "Temptress Martini", price: "13" },
      { name: "Margarita Fiesta", price: "13" },
      { name: "Sapphire Blue Lagoon", price: "13" },
      { name: "Rum Punch", price: "11" },
      { name: "Pineapple Punch", price: "9" },
      { name: "Guinness Punch", price: "9" },
    ],
  },
  {
    id: "spirits",
    name: "Spirits & Liquor",
    kind: "drink",
    items: [
      { name: "Azul", price: "400" },
      { name: "Casamigos Reposado", price: "180" },
      { name: "Casamigos Blanco", price: "150" },
      { name: "Hennessy VSOP", price: "180" },
      { name: "Hennessy VS", price: "120" },
      { name: "Courvoisier", price: "100" },
      { name: "Ciroc", price: "120" },
      { name: "Grey Goose", price: "120" },
      { name: "House Tequila", price: "80" },
    ],
  },
  {
    id: "champagne",
    name: "Champagne",
    kind: "drink",
    items: [
      { name: "Moet Brut", price: "120" },
      { name: "Belaire Rose", price: "90" },
      { name: "Prosecco", price: "35" },
    ],
  },
  {
    id: "wine",
    name: "Wine",
    kind: "drink",
    items: [
      { name: "Rose", price: "25" },
      { name: "White", price: "25" },
      { name: "Red", price: "25" },
    ],
  },
  {
    id: "drinks",
    name: "Soft Drinks",
    kind: "drink",
    items: [
      { name: "Nigerian Fanta", price: "6.5" },
      { name: "Supermalt", price: "4" },
      {
        name: "Soft Drink",
        price: "3",
        variant: "Coke · Fanta · Rubicon Mango · Ginger Beer",
      },
      { name: "Juice", price: "3", variant: "Apple · Orange" },
      { name: "Water", variant: "Large 6 · Small 3" },
    ],
  },
];