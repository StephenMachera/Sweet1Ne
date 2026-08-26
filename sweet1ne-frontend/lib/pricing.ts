/**
 * Pricing helpers shared between the staff menu and the customer page.
 *
 * Kept in its own module so both surfaces charge identically, and so the
 * logic can be tested directly rather than duplicated in a test file.
 */

export type PricedItem = {
  price: number;
  promo_price: number | null;
};

/** What an item actually costs right now — the promo price if there is one. */
export function effectivePrice(item: PricedItem): number {
  // ?? rather than || — a promo price of 0 means free, not "fall back".
  return item.promo_price ?? item.price;
}

/** What the customer pays for a set of lines. */
export function cartTotal(lines: { item: PricedItem; quantity: number }[]): number {
  return lines.reduce((sum, line) => sum + effectivePrice(line.item) * line.quantity, 0);
}

/** The difference between list prices and what's actually being charged. */
export function cartSaving(lines: { item: PricedItem; quantity: number }[]): number {
  const atListPrice = lines.reduce(
    (sum, line) => sum + line.item.price * line.quantity,
    0
  );
  return atListPrice - cartTotal(lines);
}