"use client";

import { useState } from "react";
import { CoursePictureDialog } from "./course-picture-dialog";
import { resolveStation, type MainCategory, type MenuItem, type SubCategory } from "./menu-browser";

/** The menu board — one chapter per course (main category), each with its
 *  own medal picture and a list of dishes with circular thumbnails.
 *  `items` is expected already filtered (search, category pill, place) —
 *  this only decides which chapters have anything to show. */
export function MenuBoard({
  mains,
  subs,
  items,
  onEditItem,
  onToggleItem,
  onCategoryChanged,
  onStationChange,
}: {
  mains: MainCategory[];
  subs: SubCategory[];
  items: MenuItem[];
  onEditItem: (item: MenuItem) => void;
  onToggleItem: (item: MenuItem) => void;
  onCategoryChanged: (updated: MainCategory) => void;
  onStationChange: (item: MenuItem, station: "kitchen" | "bar") => void;
}) {
  const [pictureFor, setPictureFor] = useState<MainCategory | null>(null);
  const subById = new Map(subs.map((s) => [s.id, s]));

  const chapters = mains
    .map((main) => ({
      main,
      rows: items.filter((item) => {
        const sub = subById.get(item.sub_category_id);
        return sub?.main_category_id === main.id;
      }),
    }))
    .filter((c) => c.rows.length > 0);

  if (chapters.length === 0) {
    return <p className="admin-empty">No items match that search.</p>;
  }

  return (
    <>
      {chapters.map(({ main, rows }) => (
        <section className="admin-menu-chapter" key={main.id}>
          <div className="admin-menu-chapter-head">
            <button
              type="button"
              className={`admin-menu-mark${main.picture ? "" : " is-empty"}`}
              aria-label={`Change ${main.name} picture`}
              onClick={() => setPictureFor(main)}
            >
              {main.picture && <img src={main.picture} alt="" />}
            </button>
            <div>
              <p className="admin-kicker">{main.name}</p>
              <p className="admin-dek">
                {rows.length} {rows.length === 1 ? "dish" : "dishes"}
              </p>
            </div>
            <button type="button" className="admin-edit" onClick={() => setPictureFor(main)}>
              Picture
            </button>
          </div>

          <div className="admin-menu-list">
            {rows.map((item) => (
              <div className={`admin-menu-dish${item.is_available ? "" : " is-off"}`} key={item.id}>
                <button
                  type="button"
                  className={`admin-toggle${item.is_available ? " is-on" : ""}`}
                  aria-label="On"
                  onClick={() => onToggleItem(item)}
                />
                {item.picture ? (
                  <img src={item.picture} alt="" />
                ) : (
                  <span className="admin-menu-gap" />
                )}
                <div>
                  <h3>{item.title}</h3>
                  {item.description && <p className="admin-muted">{item.description}</p>}
                </div>
                <p className="admin-price">
                  {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
                    item.price,
                  )}
                </p>
                <div className="admin-station-pair" role="group" aria-label="Preparation">
                  {(["kitchen", "bar"] as const).map((station) => (
                    <button
                      key={station}
                      type="button"
                      className={resolveStation(item, mains, subs) === station ? "is-on" : undefined}
                      onClick={() => onStationChange(item, station)}
                    >
                      {station === "bar" ? "Bar" : "Kitchen"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button type="button" className="admin-edit" onClick={() => onEditItem(item)}>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <CoursePictureDialog
        category={pictureFor}
        onClose={() => setPictureFor(null)}
        onSaved={onCategoryChanged}
      />
    </>
  );
}
