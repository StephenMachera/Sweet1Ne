"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { ReservationList } from "@/components/reservations/reservation-list";

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
  const [enquiryCount, setEnquiryCount] = useState<number | null>(null);

  const loadEnquiries = useCallback(() => {
    // Just for the card's stat — the real list below does its own fetching.
    apiFetch("/reservations?status=pending")
      .then((rows: { reservation_type: string }[]) =>
        setEnquiryCount(rows.filter((r) => r.reservation_type === "enquiry").length)
      )
      .catch(() => setEnquiryCount(null));
  }, []);

  useEffect(() => {
    apiFetch("/branches").then(setBranches).catch(() => setBranches([]));
    loadEnquiries();
  }, [loadEnquiries]);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) router.replace("/admin/dashboard");
  }, [meLoading, me, canManage, router]);

  if (meLoading || !me || !canManage) {
    return <p className="text-sm text-[var(--ivory-dim)]">Loading…</p>;
  }

  return (
    <>
      <div className="admin-top">
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Reservations</h1>
      <p className="admin-dek">Bookings wait for SevenRooms. Contact-page enquiries are live below.</p>

      <section className="admin-board tight" aria-label="Reservation sources">
        <article className="admin-card is-wait">
          <h2>Bookings</h2>
          <Stat value={null} />
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

        <article className="admin-card">
          <h2>Inquiry</h2>
          <Stat value={enquiryCount} />
          <p>Messages sent from the website&rsquo;s contact page, waiting for an answer.</p>
        </article>
      </section>

      {/* Same list, same accept/reject logic as reservation bookings would
          use — filtered to enquiry-type rows only, since Bookings above
          stays a placeholder until SevenRooms is connected. */}
      <ReservationList tone="admin" reservationTypes={["enquiry"]} hideHeader onDecided={loadEnquiries} />
    </>
  );
}

function Stat({ value }: { value: number | null }) {
  if (value === null) return <p className="admin-stat admin-hold">—</p>;
  return <p className="admin-stat">{value}</p>;
}
