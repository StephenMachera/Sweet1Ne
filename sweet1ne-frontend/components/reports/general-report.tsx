"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Campaign = {
  id: string;
  name: string;
  map_id: string | null;
  status: string;
  created_at: string;
};

/**
 * The "General" tab of /admin/reports — a first-party campaign map (which
 * promotions/mail carry a shared ID) plus a handful of real cross-page
 * counts. Deliberately does NOT invent join/click/booking numbers: nothing
 * on the guest site captures a map ID today (no ?c= param reading, no
 * AnalyticsEvent writes), so those columns/cards stay "—" until that
 * tracking is actually built, same as the reference template's own
 * "waiting" cards for Toast/SevenRooms.
 */
export function GeneralReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [enquiryCount, setEnquiryCount] = useState<number | null>(null);
  const [subscribed, setSubscribed] = useState<number | null>(null);
  const [menuCount, setMenuCount] = useState<number | null>(null);
  const [eventsCount, setEventsCount] = useState<number | null>(null);
  const [tableCounts, setTableCounts] = useState<{ total: number; attached: number } | null>(null);

  useEffect(() => {
    apiFetch("/campaigns").then(setCampaigns).catch(() => setCampaigns([]));
    apiFetch("/newsletter/stats")
      .then((s: { subscribed: number }) => setSubscribed(s.subscribed))
      .catch(() => setSubscribed(null));
    apiFetch("/staff/menu/menu-items")
      .then((items: unknown[]) => setMenuCount(items.length))
      .catch(() => setMenuCount(null));
    apiFetch("/events")
      .then((items: unknown[]) => setEventsCount(items.length))
      .catch(() => setEventsCount(null));
    apiFetch("/tables")
      .then((items: { qr_code_url: string | null }[]) =>
        setTableCounts({ total: items.length, attached: items.filter((t) => t.qr_code_url).length })
      )
      .catch(() => setTableCounts(null));
  }, []);

  useEffect(() => {
    apiFetch("/reservations")
      .then((rows: { reservation_type: string; created_at: string }[]) => {
        const enquiries = rows.filter((r) => {
          if (r.reservation_type !== "enquiry") return false;
          if (from && r.created_at < from) return false;
          if (to && r.created_at > `${to}T23:59:59`) return false;
          return true;
        });
        setEnquiryCount(enquiries.length);
      })
      .catch(() => setEnquiryCount(null));
  }, [from, to]);

  const mapped = campaigns.filter((c) => {
    if (!c.map_id) return false;
    if (from && c.created_at < from) return false;
    if (to && c.created_at > `${to}T23:59:59`) return false;
    return true;
  });

  return (
    <>
      <div className="admin-tools">
        <input
          type="date"
          aria-label="From"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          onClick={(e) => e.currentTarget.showPicker?.()}
        />
        <input
          type="date"
          aria-label="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onClick={(e) => e.currentTarget.showPicker?.()}
        />
      </div>

      <section className="admin-board tight" aria-label="What we know">
        <article className="admin-card">
          <h2>Mapped</h2>
          <p className="admin-stat">{mapped.length}</p>
          <p>Promotions and mail with an ID.</p>
          <div className="admin-acts">
            <Link className="admin-act" href="/admin/promotions">
              Promotions
            </Link>
          </div>
        </article>
        <article className="admin-card is-wait">
          <h2>Joined</h2>
          <p className="admin-stat admin-hold">—</p>
          <p>Came from a mapped ID and ticked yes.</p>
          <div className="admin-acts">
            <Link className="admin-act" href="/admin/leads">
              Leads
            </Link>
          </div>
        </article>
        <article className="admin-card is-wait">
          <h2>Wrote in</h2>
          <p className="admin-stat admin-hold">—</p>
          <p>Contact after arriving with an ID.</p>
          <div className="admin-acts">
            <Link className="admin-act" href="/admin/inbox">
              Inbox
            </Link>
          </div>
        </article>
        <article className="admin-card is-wait">
          <h2>Opened Book</h2>
          <p className="admin-stat admin-hold">—</p>
          <p>Clicked Book. Not a booking until SevenRooms connects.</p>
        </article>
      </section>

      <div className="admin-board-group">
        <h2>The map</h2>
        {mapped.length === 0 ? (
          <p className="admin-empty">
            Add a promotion or mail and give it an ID. Put that ID on the ads. This table then
            reads what people did here.
          </p>
        ) : (
          <div className="admin-data-panel">
            <table className="admin-sheet">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>ID</th>
                  <th>Put out on</th>
                  <th>Joined</th>
                  <th>Wrote in</th>
                  <th>Opened Book</th>
                  <th>Booked</th>
                </tr>
              </thead>
              <tbody>
                {mapped.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="admin-name">{c.name}</span>
                    </td>
                    <td className="admin-muted">{c.map_id}</td>
                    <td className="admin-muted">Mail</td>
                    <td className="admin-muted">—</td>
                    <td className="admin-muted">—</td>
                    <td className="admin-muted">—</td>
                    <td className="admin-muted">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-board-group">
        <h2>What they did</h2>
        <p className="admin-empty">
          Nothing from a mapped ID yet. A guest who opens Book from the home banner, or joins from
          an ad link, will sit here as a line.
        </p>
      </div>

      <section className="admin-board tight" aria-label="Waiting">
        <article className="admin-card is-wait">
          <h2>Covers</h2>
          <p className="admin-stat admin-hold">—</p>
          <p>Waiting on bookings.</p>
        </article>
        <article className="admin-card is-wait">
          <h2>Collection</h2>
          <p className="admin-stat admin-hold">—</p>
          <p>Waiting on collection tickets.</p>
        </article>
        <article className="admin-card is-wait">
          <h2>Bookings</h2>
          <p className="admin-stat admin-hold">—</p>
          <p>Waiting on bookings.</p>
        </article>
        <article className="admin-card">
          <h2>Inbox</h2>
          <p className="admin-stat">{enquiryCount ?? "—"}</p>
          <p>Enquiries from Contact.</p>
          <div className="admin-acts">
            <Link className="admin-act" href="/admin/inbox">
              Inbox
            </Link>
          </div>
        </article>
      </section>

      <section className="admin-board" aria-label="Known">
        <article className="admin-card">
          <h2>Menu</h2>
          <p className="admin-stat">{menuCount ?? "—"}</p>
          <p>Same list as the website.</p>
          <div className="admin-acts">
            <Link className="admin-act" href="/admin/menu/manage">
              Menu
            </Link>
          </div>
        </article>
        <article className="admin-card">
          <h2>Leads</h2>
          <p className="admin-stat">{subscribed ?? "—"}</p>
          <p>Asked to be emailed. Every email sits on Leads.</p>
          <div className="admin-acts">
            <Link className="admin-act" href="/admin/leads">
              Leads
            </Link>
            <Link className="admin-act" href="/admin/marketing">
              Marketing
            </Link>
          </div>
        </article>
        <article className="admin-card">
          <h2>Events</h2>
          <p className="admin-stat">{eventsCount ?? "—"}</p>
          <p>{eventsCount === 0 ? "No dated nights listed." : "Live on the website."}</p>
          <div className="admin-acts">
            <Link className="admin-act" href="/admin/events">
              Events
            </Link>
          </div>
        </article>
        <article className={`admin-card${tableCounts && tableCounts.attached < tableCounts.total ? " is-wait" : ""}`}>
          <h2>Tables</h2>
          <p className={`admin-stat${tableCounts && tableCounts.attached < tableCounts.total ? " admin-hold" : ""}`}>
            {tableCounts ? `${tableCounts.attached} / ${tableCounts.total}` : "—"}
          </p>
          <p>{tableCounts?.attached ? "QR codes attached." : "QR codes not attached."}</p>
          <div className="admin-acts">
            <Link className="admin-act" href="/admin/tables">
              Tables
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}
