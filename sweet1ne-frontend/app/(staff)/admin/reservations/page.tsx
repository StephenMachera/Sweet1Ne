"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { AdminLoading } from "@/components/admin/admin-loading";

type Branch = { id: string; name: string; phone: string | null };

function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "");
  return `tel:+44${digits}`;
}

export default function AdminReservationsPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const canManage = hasPermission(me, "manage_reservations");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [state, setState] = useState<"all" | "open" | "done">("all");
  const [query, setQuery] = useState("");

  // No booking sync is wired up yet — this stays empty until SevenRooms is
  // connected. The states/search filters below are real, just inert until
  // then, matching the reference template exactly.
  const bookings: never[] = [];

  useEffect(() => {
    apiFetch("/branches").then(setBranches).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) router.replace("/admin/dashboard");
  }, [meLoading, me, canManage, router]);

  // Old bookmarks/links to the enquiries section now belong on Inbox.
  useEffect(() => {
    if (window.location.hash === "#messages") router.replace("/admin/inbox");
  }, [router]);

  if (meLoading || !me || !canManage) {
    return <AdminLoading />;
  }

  return (
    <>
      <div className="admin-top">
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Reservations</h1>
      <p className="admin-dek">{bookings.length} bookings · SevenRooms not connected</p>

      <section className="admin-board tight" aria-label="Bookings">
        <article className="admin-card is-wait">
          <h2>Bookings</h2>
          <p className="admin-stat admin-hold">—</p>
          <p>SevenRooms not connected. Guests book from the website.</p>
          <div className="admin-acts">
            {branches
              .filter((b) => b.phone)
              .map((b) => (
                <a key={b.id} className="admin-book" href={telHref(b.phone!)}>
                  {b.name} {b.phone}
                </a>
              ))}
          </div>
        </article>
      </section>

      <div className="admin-cats" role="group" aria-label="Status">
        <button type="button" className={state === "all" ? "is-on" : undefined} onClick={() => setState("all")}>
          All
        </button>
        <button type="button" className={state === "open" ? "is-on" : undefined} onClick={() => setState("open")}>
          Open
        </button>
        <button type="button" className={state === "done" ? "is-on" : undefined} onClick={() => setState("done")}>
          Done
        </button>
      </div>
      <div className="admin-tools">
        <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {bookings.length === 0 ? (
        <p className="admin-empty">No bookings. SevenRooms is not connected.</p>
      ) : (
        <div className="admin-data-panel">
          <table className="admin-sheet">
            <thead>
              <tr>
                <th>From</th>
                <th>Party</th>
                <th>Restaurant</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody />
          </table>
        </div>
      )}
    </>
  );
}
