import { describe, expect, it } from "vitest";
import { cartSaving, cartTotal, effectivePrice } from "@/lib/pricing";

describe("effectivePrice", () => {
  it("uses the list price when there's no promotion", () => {
    expect(effectivePrice({ price: 12.5, promo_price: null })).toBe(12.5);
  });

  it("uses the promo price when there is one", () => {
    expect(effectivePrice({ price: 20, promo_price: 15 })).toBe(15);
  });

  it("uses a promo price of zero rather than falling back", () => {
    // Using || here instead of ?? would charge £20 for a free item.
    expect(effectivePrice({ price: 20, promo_price: 0 })).toBe(0);
  });
});

describe("cartTotal", () => {
  it("adds up plain items", () => {
    const lines = [
      { item: { price: 10, promo_price: null }, quantity: 2 },
      { item: { price: 5, promo_price: null }, quantity: 1 },
    ];

    expect(cartTotal(lines)).toBe(25);
  });

  it("charges the promo price", () => {
    const lines = [{ item: { price: 20, promo_price: 15 }, quantity: 2 }];

    expect(cartTotal(lines)).toBe(30);
  });

  it("handles an empty cart", () => {
    expect(cartTotal([])).toBe(0);
  });
});

describe("cartSaving", () => {
  it("is zero when nothing is discounted", () => {
    const lines = [{ item: { price: 10, promo_price: null }, quantity: 2 }];

    expect(cartSaving(lines)).toBe(0);
  });

  it("reports the difference against list prices", () => {
    const lines = [{ item: { price: 20, promo_price: 15 }, quantity: 2 }];

    expect(cartSaving(lines)).toBe(10);
  });

  it("mixes discounted and full-price items", () => {
    const lines = [
      { item: { price: 20, promo_price: 15 }, quantity: 1 },
      { item: { price: 5, promo_price: null }, quantity: 1 },
    ];

    expect(cartTotal(lines)).toBe(20);
    expect(cartSaving(lines)).toBe(5);
  });

  it("handles an empty cart", () => {
    expect(cartSaving([])).toBe(0);
  });
});