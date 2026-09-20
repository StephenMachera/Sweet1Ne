"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Mail,
  Phone,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Reservation = {
  id: string;
  branch_id: string;
  branch_name: string | null;
  name: string;
  email: string;
  phone: string;
  reservation_type: string;
  party_size: number;
  requested_at: string | null;
  occasion: string | null;
  notes: string | null;
  status: string;
  staff_message: string | null;
  handled_at: string | null;
  handled_by_name: string | null;
  marketing_consent: boolean;
  created_at: string;
};

const FILTERS = [
  { key: "pending", label: "Needs an answer" },
  { key: "confirmed", label: "Confirmed" },
  { key: "declined", label: "Declined" },
  { key: "", label: "All upcoming" },
];

// Literal colors, not var(--gold-line) etc — Dialog portals to
// document.body, outside .admin-shell, so those custom properties (only
// defined under that class) don't cascade here.
const DARK_DIALOG = "border border-[rgba(201,162,74,0.42)] bg-[#0c0c0c] text-[#e5e2e1] sm:max-w-md";
const DIALOG_BOOK_BTN =
  "inline-flex items-center justify-center rounded-[3px] border border-[rgba(201,162,74,0.9)] bg-transparent px-[1.15rem] py-[0.6rem] text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#c9a24a] hover:bg-[#c9a24a] hover:text-[#0e0e0e] disabled:opacity-50";
const DIALOG_GHOST_BTN = "px-[1.15rem] py-[0.6rem] text-[0.75rem] uppercase tracking-[0.1em] text-[rgba(229,226,225,0.68)] hover:text-[#e5e2e1]";

function when(iso: string | null) {
  if (!iso) return "Enquiry";
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function time(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** How long a request has been sitting unanswered. */
function waitingHours(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
}

export function ReservationList({
  tone,
  reservationTypes,
  hideHeader = false,
  onDecided,
}: {
  tone: "admin" | "branch";
  /** Only show these reservation_type values — omit to show everything
     (table, private and enquiry mixed), which is what the branch console
     still does. The admin Reservations page passes ["enquiry"] to keep
     that card's list to contact-page messages only. */
  reservationTypes?: string[];
  /** The admin page renders its own <h1>/count above two summary cards;
     this skips this component's own, so they don't duplicate. */
  hideHeader?: boolean;
  /** Fires after a confirm/decline succeeds, so a parent showing its own
     summary count (e.g. the Inquiry card) can refresh it. */
  onDecided?: () => void;
}) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{
    reservation: Reservation;
    status: "confirmed" | "declined";
  } | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isBranch = tone === "branch";

  const card = isBranch
    ? "border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    : "border-[var(--gold-line)] bg-[var(--panel)]";
  const text = isBranch ? "text-navy" : "text-[var(--ivory)]";
  const muted = isBranch ? "text-slate-muted" : "text-[var(--ivory-dim)]";
  const subtle = isBranch ? "text-slate-subtle" : "text-[var(--ivory-dim)]";
  const accept = isBranch
    ? "bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
    : "admin-book";
  const decline = isBranch
    ? "bg-danger-bg text-danger hover:bg-danger/15"
    : "admin-edit";

  const statusStyles: Record<string, string> = isBranch
    ? {
        pending: "bg-warning-bg text-warning",
        confirmed: "bg-success-bg text-success",
        declined: "bg-danger-bg text-danger",
        cancelled: "bg-slate-bg text-slate-subtle",
      }
    : {
        pending: "border border-[var(--gold-line)] text-[var(--gold)]",
        confirmed: "bg-[var(--gold)] text-[#0e0e0e]",
        declined: "text-[var(--ivory-dim)] line-through",
        cancelled: "text-[var(--ivory-dim)]",
      };

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);

    setLoading(true);
    return apiFetch(`/reservations?${params.toString()}`)
      .then(setReservations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
    // Requests arrive while nobody's watching — a quiet refresh means the
    // list is current when someone does look.
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  async function decide() {
    if (!deciding) return;

    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/reservations/${deciding.reservation.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: deciding.status,
          staff_message: message || null,
        }),
      });

      setReservations((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
      setDeciding(null);
      setMessage("");

      // If we're looking at pending only, it's no longer in this list.
      if (filter === "pending") load();
      onDecided?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  const visible = reservationTypes
    ? reservations.filter((r) => reservationTypes.includes(r.reservation_type))
    : reservations;
  const pendingCount = visible.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className={`text-2xl font-semibold sm:text-3xl ${text}`}>Reservations</h1>
            <p className={`mt-1 text-sm ${subtle}`}>
              {visible.length} {visible.length === 1 ? "request" : "requests"}
              {filter === "pending" && pendingCount > 0 && " waiting on you"}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className={`rounded-xl px-4 py-3 text-sm ${
            isBranch
              ? "border border-danger/25 bg-danger-bg text-danger"
              : "border border-[var(--gold-line)] text-[var(--gold)]"
          }`}
        >
          {error}
        </div>
      )}

      {/* Filters */}
      <div className={isBranch ? "flex flex-wrap gap-2" : "admin-cats"} role={isBranch ? undefined : "group"}>
        {FILTERS.map((f) =>
          isBranch ? (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-navy text-white"
                  : "border border-slate-border bg-white text-slate-subtle hover:text-navy"
              }`}
            >
              {f.label}
            </button>
          ) : (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? "is-on" : undefined}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          )
        )}
      </div>

      {loading ? (
        <p className={`text-sm ${muted}`}>Loading…</p>
      ) : visible.length === 0 ? (
        isBranch ? (
          <div className="rounded-xl border border-dashed border-slate-border px-6 py-16 text-center">
            <CalendarDays size={26} strokeWidth={1} className={`mx-auto ${muted}`} />
            <p className={`mt-3 text-sm ${muted}`}>
              {filter === "pending" ? "Nothing waiting for an answer." : "No reservations here."}
            </p>
          </div>
        ) : (
          <p className="admin-empty">
            {filter === "pending" ? "Nothing waiting for an answer." : "Nothing here."}
          </p>
        )
      ) : (
        <ul className="space-y-3">
          {visible.map((reservation) => {
            const expanded = expandedId === reservation.id;
            const isPending = reservation.status === "pending";
            const waiting = waitingHours(reservation.created_at);
            // Someone waiting more than four hours for an answer is a
            // problem worth surfacing.
            const overdue = isPending && waiting >= 4;

            return (
              <li
                key={reservation.id}
                className={`overflow-hidden rounded-xl border ${card} ${
                  overdue ? (isBranch ? "ring-1 ring-warning" : "ring-1 ring-[var(--gold)]") : ""
                }`}
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : reservation.id)}
                  className="flex w-full items-center gap-4 px-4 py-4 text-left sm:px-5"
                >
                  {/* When — the thing you scan for. */}
                  <div className={`shrink-0 text-center ${text}`}>
                    <p className="text-[11px] uppercase tracking-[0.1em] opacity-60">
                      {when(reservation.requested_at)}
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums">
                      {time(reservation.requested_at)}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-medium ${text}`}>{reservation.name}</span>

                      <span className={`inline-flex items-center gap-1 text-sm ${muted}`}>
                        <Users size={13} />
                        {reservation.party_size}
                      </span>

                      {reservation.reservation_type === "private" && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            isBranch
                              ? "bg-purple-bg text-purple"
                              : "border border-[var(--gold-line)] text-[var(--gold)]"
                          }`}
                        >
                          Private hire
                        </span>
                      )}

                      {reservation.occasion && (
                        <span className={`inline-flex items-center gap-1 text-xs ${muted}`}>
                          <Sparkles size={12} />
                          {reservation.occasion}
                        </span>
                      )}

                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                          statusStyles[reservation.status]
                        }`}
                      >
                        {reservation.status}
                      </span>
                    </div>

                    <p className={`mt-1 truncate text-xs ${muted}`}>
                      {reservation.branch_name}
                      {isPending && ` · asked ${waiting}h ago`}
                      {reservation.handled_by_name &&
                        ` · handled by ${reservation.handled_by_name}`}
                    </p>
                  </div>

                  <ChevronDown
                    size={17}
                    className={`shrink-0 ${muted} transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {expanded && (
                  <div
                    className={`border-t px-4 py-4 sm:px-5 ${
                      isBranch ? "border-slate-bg bg-slate-bg/30" : "border-[var(--gold-line)] bg-[#080808]"
                    }`}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <a href={`tel:${reservation.phone.replace(/\s/g, "")}`} className={`flex items-center gap-2.5 text-sm ${text}`}>
                        <Phone size={15} strokeWidth={1} className={muted} />
                        {reservation.phone}
                      </a>

                      <a href={`mailto:${reservation.email}`} className={`flex items-center gap-2.5 truncate text-sm ${text}`}>
                        <Mail size={15} strokeWidth={1} className={muted} />
                        {reservation.email}
                      </a>
                    </div>

                    {reservation.notes && (
                      <div
                        className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                          isBranch ? "bg-warning-bg text-warning" : "border border-[var(--gold-line)] text-[var(--gold)]"
                        }`}
                      >
                        {reservation.notes}
                      </div>
                    )}

                    {reservation.staff_message && (
                      <div className={`mt-3 text-sm ${muted}`}>
                        <span className="font-medium">Your message:</span>{" "}
                        {reservation.staff_message}
                      </div>
                    )}

                    {reservation.marketing_consent && (
                      <p className={`mt-3 text-xs ${muted}`}>
                        Opted in to marketing emails.
                      </p>
                    )}

                    {isPending && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {isBranch ? (
                          <>
                            <Button
                              onClick={() => {
                                setDeciding({ reservation, status: "confirmed" });
                                setMessage("");
                              }}
                              className={accept}
                            >
                              <Check size={16} className="mr-1.5" />
                              Confirm
                            </Button>
                            <Button
                              onClick={() => {
                                setDeciding({ reservation, status: "declined" });
                                setMessage("");
                              }}
                              className={decline}
                            >
                              <X size={16} className="mr-1.5" />
                              Can&apos;t do it
                            </Button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={accept}
                              onClick={() => {
                                setDeciding({ reservation, status: "confirmed" });
                                setMessage("");
                              }}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className={decline}
                              onClick={() => {
                                setDeciding({ reservation, status: "declined" });
                                setMessage("");
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Decision dialog — the message goes into the email, so it's worth
          a moment rather than a one-click accept. */}
      <Dialog open={deciding !== null} onOpenChange={(open) => !open && setDeciding(null)}>
        <DialogContent className={isBranch ? "sm:max-w-md" : DARK_DIALOG}>
          <DialogHeader>
            <DialogTitle className={`text-xl font-semibold ${isBranch ? text : "text-[#e5e2e1]"}`}>
              {deciding?.status === "confirmed"
                ? `Confirm ${deciding.reservation.name}'s table?`
                : `Let ${deciding?.reservation.name} down gently`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className={`text-sm ${isBranch ? subtle : "text-[rgba(229,226,225,0.68)]"}`}>
              {deciding?.status === "confirmed"
                ? "They'll get a confirmation email straight away."
                : "They'll get an email explaining. A reason helps."}
            </p>

            <div className="space-y-1">
              <label
                htmlFor="staff-message"
                className={`text-sm ${isBranch ? text : "text-[#e5e2e1]"}`}
              >
                {deciding?.status === "confirmed"
                  ? "Anything to add? (optional)"
                  : "Why not? (optional)"}
              </label>
              <textarea
                id="staff-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  deciding?.status === "confirmed"
                    ? "We've put you by the window — see you then."
                    : "We're fully booked that evening, but we could do 9pm?"
                }
                className={
                  isBranch
                    ? "w-full resize-none rounded-lg border border-slate-border px-3 py-2.5 text-sm"
                    : "w-full resize-none rounded-[3px] border border-[rgba(201,162,74,0.35)] bg-[#050505] px-3 py-2.5 text-sm text-[#e5e2e1]"
                }
              />
            </div>

            <div className="flex justify-end gap-3">
              {isBranch ? (
                <>
                  <Button variant="ghost" onClick={() => setDeciding(null)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={decide} disabled={saving} className={deciding?.status === "confirmed" ? accept : decline}>
                    {saving ? "Sending…" : deciding?.status === "confirmed" ? "Confirm and email" : "Decline and email"}
                  </Button>
                </>
              ) : (
                <>
                  <button type="button" className={DIALOG_GHOST_BTN} onClick={() => setDeciding(null)} disabled={saving}>
                    Cancel
                  </button>
                  <button type="button" className={DIALOG_BOOK_BTN} onClick={decide} disabled={saving}>
                    {saving ? "Sending…" : deciding?.status === "confirmed" ? "Confirm and email" : "Decline and email"}
                  </button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
