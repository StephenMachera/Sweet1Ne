"use client";

import { resolveStation, type MainCategory, type MenuItem, type SubCategory } from "./menu-browser";

/** The Preparation Deck — every dish sorted into Kitchen or Bar, whichever
   station actually fires it (its own override, else its category's). Each
   row carries the same station-pair toggle as the normal list, plus a
   quick "Add to Kitchen"/"Add to Bar" per pile. `items` is expected
   already filtered (search/category/branch scope), same as the list
   view — this only decides which pile each row lands in. */
export function MenuPrepDeck({
  mains,
  subs,
  items,
  onEditItem,
  onStationChange,
  onAddToStation,
}: {
  mains: MainCategory[];
  subs: SubCategory[];
  items: MenuItem[];
  onEditItem: (item: MenuItem) => void;
  onStationChange: (item: MenuItem, station: "kitchen" | "bar") => void;
  onAddToStation: (station: "kitchen" | "bar") => void;
}) {
  const subById = new Map(subs.map((s) => [s.id, s]));
  const mainById = new Map(mains.map((m) => [m.id, m]));

  const kitchenRows = items.filter((i) => resolveStation(i, mains, subs) === "kitchen");
  const barRows = items.filter((i) => resolveStation(i, mains, subs) === "bar");

  function pile(label: string, station: "kitchen" | "bar", rows: MenuItem[]) {
    return (
      <article className="admin-prep-pile">
        <header>
          <div>
            <p className="admin-kicker">{label}</p>
            <h2>{rows.length}</h2>
          </div>
          <button type="button" className="admin-book" onClick={() => onAddToStation(station)}>
            Add to {label}
          </button>
        </header>
        <div className="admin-prep-list">
          {rows.length === 0 ? (
            <p className="admin-empty">Nothing on {label} for this filter.</p>
          ) : (
            rows.map((item) => {
              const sub = subById.get(item.sub_category_id);
              const main = sub ? mainById.get(sub.main_category_id) : undefined;
              const meta = [
                item.is_available ? "On" : "Off",
                main?.name,
                sub?.name,
                new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(item.price),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div key={item.id} className={`admin-prep-row${item.is_available ? "" : " is-off"}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <p className="admin-muted">{meta}</p>
                  </div>
                  <div className="admin-station-pair" role="group" aria-label="Preparation">
                    {(["kitchen", "bar"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={resolveStation(item, mains, subs) === s ? "is-on" : undefined}
                        onClick={() => onStationChange(item, s)}
                      >
                        {s === "bar" ? "Bar" : "Kitchen"}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="admin-edit" onClick={() => onEditItem(item)}>
                    Edit
                  </button>
                </div>
              );
            })
          )}
        </div>
      </article>
    );
  }

  return (
    <section className="admin-prep-deck">
      <p className="admin-dek">
        Each dish is Kitchen or Bar before it hits the pass. Gold is the station. Kitchen and Bar
        read this to know which items are theirs.
      </p>
      <div className="admin-prep-piles">
        {pile("Kitchen", "kitchen", kitchenRows)}
        {pile("Bar", "bar", barRows)}
      </div>
    </section>
  );
}
