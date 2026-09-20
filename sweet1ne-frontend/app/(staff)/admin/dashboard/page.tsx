"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";

type Place = "both" | "lewisham" | "chingford";

type Counts = {
  menu: number | null;
  menuPhotos: number | null;
  events: number | null;
  branches: number | null;
  promotions: number | null;
  tables: number | null;
  tablesAttached: number | null;
  staff: number | null;
  leads: number | null;
};

const EMPTY_COUNTS: Counts = {
  menu: null,
  menuPhotos: null,
  events: null,
  branches: null,
  promotions: null,
  tables: null,
  tablesAttached: null,
  staff: null,
  leads: null,
};

function Stat({ value, wait = false }: { value: number | string | null; wait?: boolean }) {
  if (value === null) {
    return <p className={`admin-stat${wait ? " admin-hold" : ""}`}>—</p>;
  }
  return <p className="admin-stat">{value}</p>;
}

// Ticks every second so the top bar reads as live even when nothing else
// on the page has changed — not part of the reference template.
function useClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

export default function DashboardPage() {
  const { me } = useMe();
  const [place, setPlace] = useState<Place>("both");
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const now = useClock();

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    const apply = (patch: Partial<Counts>) => {
      if (!cancelled) setCounts((c) => ({ ...c, ...patch }));
    };

    if (hasPermission(me, "view_menu")) {
      apiFetch("/staff/menu/menu-items")
        .then((items: { picture: string | null }[]) =>
          apply({ menu: items.length, menuPhotos: items.filter((i) => i.picture).length })
        )
        .catch(() => {});
    }
    if (hasPermission(me, "manage_promotions")) {
      apiFetch("/events")
        .then((items: unknown[]) => apply({ events: items.length }))
        .catch(() => {});
      apiFetch("/promos")
        .then((items: unknown[]) => apply({ promotions: items.length }))
        .catch(() => {});
    }
    apiFetch("/branches")
      .then((items: unknown[]) => apply({ branches: items.length }))
      .catch(() => {});
    if (hasPermission(me, "manage_tables")) {
      apiFetch("/tables")
        .then((items: { qr_code_url: string | null }[]) =>
          apply({
            tables: items.length,
            tablesAttached: items.filter((t) => t.qr_code_url).length,
          })
        )
        .catch(() => {});
    }
    if (hasPermission(me, "manage_staff")) {
      apiFetch("/staff")
        .then((items: unknown[]) => apply({ staff: items.length }))
        .catch(() => {});
    }
    if (hasPermission(me, "manage_marketing")) {
      // Newsletter subscribers, not true multi-source leads — closest real
      // data until Leads has its own model (QR scans, site joins, imports).
      apiFetch("/newsletter/stats")
        .then((stats: { total: number }) => apply({ leads: stats.total }))
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [me]);

  const tablesNote =
    counts.tables !== null
      ? `${counts.tables} table${counts.tables === 1 ? "" : "s"} on the floor.`
      : "Table numbers for Lewisham and Chingford.";

  const qrNote =
    counts.tables !== null && counts.tablesAttached !== null
      ? `${counts.tablesAttached} of ${counts.tables} tables have a code${
          counts.menuPhotos !== null ? ` · ${counts.menuPhotos} dishes with a picture` : ""
        }.`
      : "Table codes and the phone menu.";

  return (
    <>
      <div className="admin-top">
        <p className="admin-clock">
          {now
            ? `${now.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })} · ${now.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}`
            : "—"}
        </p>
        <div className="admin-places" role="group" aria-label="Restaurant">
          {(["both", "lewisham", "chingford"] as Place[]).map((p) => (
            <button
              key={p}
              type="button"
              className={place === p ? "is-on" : undefined}
              onClick={() => setPlace(p)}
            >
              {p === "both" ? "Both" : p === "lewisham" ? "Lewisham" : "Chingford"}
            </button>
          ))}
        </div>
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Dashboard</h1>
      <p className="admin-dek">Lewisham · Chingford</p>

      <div className="admin-board-group">
        <h2>Guest site</h2>
        <section className="admin-board" aria-label="Guest site">
          <article className="admin-card">
            <h2>Menu</h2>
            <Stat value={counts.menu} />
            <p>Same list as the website and the table phone. Pictures sit on each dish.</p>
            <Link className="admin-act" href="/admin/menu/manage">Menu</Link>
          </article>
          <article className="admin-card">
            <h2>Events</h2>
            <Stat value={counts.events} />
            <p>Nights listed on What&rsquo;s next.</p>
            <Link className="admin-act" href="/admin/events">Events</Link>
          </article>
          <article className="admin-card">
            <h2>Branches</h2>
            <Stat value={counts.branches} />
            <p>Lewisham and Chingford. Hours and collection links.</p>
            <Link className="admin-act" href="/admin/branches">Branches</Link>
          </article>
          <article className="admin-card">
            <h2>Promotions</h2>
            <Stat value={counts.promotions} />
            <p>Live ones open a banner after Enter Sweet1NE.</p>
            <Link className="admin-act" href="/admin/promotions">Promotions</Link>
          </article>
          <article className="admin-card">
            <h2>Media</h2>
            <p>Photos for mail, nights and the menu.</p>
            <Link className="admin-act" href="/admin/media">Media</Link>
          </article>
        </section>
      </div>

      <div className="admin-board-group">
        <h2>Floor</h2>
        <section className="admin-board" aria-label="Floor">
          <article className="admin-card">
            <h2>Tables</h2>
            <Stat value={counts.tables} />
            <p>{tablesNote}</p>
            <Link className="admin-act" href="/admin/tables">Tables</Link>
          </article>
          <article className="admin-card is-wait">
            <h2>QR Codes</h2>
            <Stat value={counts.tablesAttached} />
            <p>{qrNote}</p>
            <Link className="admin-act" href="/admin/qr">QR Codes</Link>
          </article>
          <article className="admin-card is-wait">
            <h2>Orders</h2>
            <Stat value={null} wait />
            <p>Collection is live. Tickets list here when connected.</p>
            <Link className="admin-act" href="/admin/orders">Orders</Link>
          </article>
          <article className="admin-card is-wait">
            <h2>Reservations</h2>
            <Stat value={null} wait />
            <p>Guests still book on the website.</p>
            <Link className="admin-act" href="/admin/reservations">Reservations</Link>
          </article>
          <article className="admin-card is-wait">
            <h2>Kitchen · Bar</h2>
            <Stat value={null} wait />
            <p>Pass and 86. Same menu as the website.</p>
            <div className="admin-acts">
              <Link className="admin-act" href="/admin/kitchen">Kitchen</Link>
              <Link className="admin-act" href="/admin/bar">Bar</Link>
            </div>
          </article>
        </section>
      </div>

      <div className="admin-board-group">
        <h2>People</h2>
        <section className="admin-board" aria-label="People">
          <article className="admin-card">
            <h2>Inbox</h2>
            <Stat value={null} />
            <p>Enquiries from Contact. Also sent to info@sweet1ne.com.</p>
            <Link className="admin-act" href="/admin/inbox">Inbox</Link>
          </article>
          <article className="admin-card">
            <h2>Leads</h2>
            <Stat value={counts.leads} />
            <p>Emails from the table, the site and import. Mail only if they ticked.</p>
            <div className="admin-acts">
              <Link className="admin-act" href="/admin/leads">Leads</Link>
              <Link className="admin-act" href="/admin/marketing">Marketing</Link>
            </div>
          </article>
          <article className="admin-card">
            <h2>Staff</h2>
            <Stat value={counts.staff} />
            <p>Who can sign in. Permissions on Roles.</p>
            <div className="admin-acts">
              <Link className="admin-act" href="/admin/staff">Staff</Link>
              <Link className="admin-act" href="/admin/roles">Roles</Link>
            </div>
          </article>
        </section>
      </div>

      <div className="admin-board-group">
        <h2>System</h2>
        <section className="admin-board" aria-label="System">
          <article className="admin-card">
            <h2>Reports</h2>
            <p className="admin-stat">Map</p>
            <p>What filled the floor from a campaign ID. Booked waits for SevenRooms.</p>
            <Link className="admin-act" href="/admin/reports">Reports</Link>
          </article>
          <article className="admin-card">
            <h2>Settings</h2>
            <Stat value={null} />
            <p>Connection status. No keys on this page.</p>
            <Link className="admin-act" href="/admin/settings">Settings</Link>
          </article>
        </section>
      </div>
    </>
  );
}
