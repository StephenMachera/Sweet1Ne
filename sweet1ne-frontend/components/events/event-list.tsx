"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ExternalLink, Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { EventForm, type Event } from "./event-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Option = { id: string; name: string };

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Past, on now, or still to come — drives the badge and the grouping. */
function status(event: Event): "past" | "live" | "upcoming" {
  const now = Date.now();
  const starts = new Date(event.starts_at).getTime();
  const ends = event.ends_at ? new Date(event.ends_at).getTime() : starts;

  if (ends < now) return "past";
  if (starts <= now) return "live";
  return "upcoming";
}

export function EventList({
  tone,
  showBranchPicker,
}: {
  // Admin no longer uses this component — its events page has its own
  // block-composer UI (app/(staff)/admin/events/page.tsx) that this
  // simple upload-based form can't support. Kept branch-only rather than
  // deleting the tone concept, in case a lighter admin view returns.
  tone: "branch";
  showBranchPicker: boolean;
}) {
  const [events, setEvents] = useState<Event[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Event | undefined>();

  // Matched to the admin console's gold/ivory palette — design only, same
  // simpler upload-based form either way (admin's events page uses its own
  // unrelated block-composer, which this component was never asked to
  // become; tone just names this card/colour set now).
  void tone;
  const card = "border-[var(--gold-line)] bg-gradient-to-b from-[var(--panel)] to-[#0a0a0a] shadow-[0_12px_40px_rgba(0,0,0,0.35)]";
  const text = "text-[var(--ivory)]";
  const muted = "text-[var(--ivory-dim)]";
  const subtle = "text-[var(--ivory-dim)]";
  const primary = "bg-[var(--gold)] text-[#0e0e0e] hover:bg-[#ead7a2]";
  const liveBadge = "bg-[var(--gold)] text-[#0e0e0e]";
  const upcomingBadge = "border border-[var(--gold-line)] text-[var(--gold)]";
  const pastBadge = "border border-[var(--gold-line)] text-[var(--ivory-dim)]";

  const load = useCallback(
    () =>
      apiFetch("/events")
        .then(setEvents)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
    if (showBranchPicker) {
      apiFetch("/branches")
        .then((list: { id: string; name: string }[]) => setBranches(list.map((b) => ({ id: b.id, name: b.name }))))
        .catch(() => setBranches([]));
    }
  }, [load, showBranchPicker]);

  async function togglePublished(event: Event) {
    setError(null);
    try {
      const updated = await apiFetch(`/events/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_published: !event.is_published }),
      });
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update that event.");
    }
  }

  const upcoming = events.filter((e) => status(e) !== "past");
  const past = events.filter((e) => status(e) === "past");

  function renderEvent(event: Event) {
    const state = status(event);

    return (
      <li key={event.id} className={`overflow-hidden rounded-xl border ${card}`}>
        <div className="flex gap-4 p-4">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt=""
              className="h-24 w-24 shrink-0 rounded-lg object-cover sm:h-28 sm:w-40"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-white/5 sm:h-28 sm:w-40">
              <CalendarDays size={22} strokeWidth={1} className={muted} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className={`font-medium ${text}`}>{event.title}</h3>

              <div className="flex shrink-0 gap-1.5">
                {!event.is_published && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${pastBadge}`}>
                    Hidden
                  </span>
                )}
                {event.is_featured && event.is_published && state !== "past" && (
                  <span className="rounded-full border border-[var(--gold-line)] px-2 py-0.5 text-[11px] font-medium text-[var(--gold)]">
                    Announced
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    state === "live"
                      ? liveBadge
                      : state === "upcoming"
                        ? upcomingBadge
                        : pastBadge
                  }`}
                >
                  {state === "live" ? "On now" : state === "upcoming" ? "Upcoming" : "Past"}
                </span>
              </div>
            </div>

            {event.tagline && <p className={`mt-1 text-sm ${subtle}`}>{event.tagline}</p>}

            <p className={`mt-2 text-sm ${muted}`}>
              {when(event.starts_at)} · {time(event.starts_at)}
              {event.ends_at && ` – ${time(event.ends_at)}`}
            </p>

            <p className={`mt-1 text-sm ${muted}`}>
              {event.branch_name ?? "Both branches"}
              {event.price_note && ` · ${event.price_note}`}
            </p>

            <div className="mt-3 flex flex-wrap gap-1">
              <button
                onClick={() => {
                  setEditing(event);
                  setFormOpen(true);
                }}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs ${muted} ${
                  "hover:bg-white/5"
                }`}
              >
                <Pencil size={14} />
                Edit
              </button>

              <button
                onClick={() => togglePublished(event)}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs ${muted} ${
                  "hover:bg-white/5"
                }`}
              >
                {event.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                {event.is_published ? "Hide" : "Publish"}
              </button>

              {event.is_published && (
                
                <a  href={`/events/${event.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs ${muted} ${
                    "hover:bg-white/5"
                  }`}
                >
                  <ExternalLink size={14} />
                  View
                </a>
              )}
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={`text-2xl font-semibold sm:text-3xl ${text}`}>Events</h1>
          <p className={`mt-1 text-sm ${subtle}`}>
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
          className={primary}
        >
          <Plus size={16} className="mr-1.5" />
          New event
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className={`text-sm ${muted}`}>Loading…</p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--gold-line)] px-6 py-16 text-center">
          <CalendarDays size={26} strokeWidth={1} className={`mx-auto ${muted}`} />
          <p className={`mt-3 text-sm ${muted}`}>
            No events yet. Create one and it&apos;ll appear on the website.
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && <ul className="space-y-3">{upcoming.map(renderEvent)}</ul>}

          {past.length > 0 && (
            <>
              <p className={`pt-4 text-[11px] uppercase tracking-[0.14em] ${muted}`}>
                Past events
              </p>
              <ul className="space-y-3 opacity-60">{past.map(renderEvent)}</ul>
            </>
          )}
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        {/* admin-shell here too — Dialog portals to document.body, outside
           the layout's own admin-shell, so the --gold/--ivory custom
           properties this form's colours depend on need their own scope. */}
        <DialogContent className="admin-shell max-h-[90vh] overflow-y-auto border border-[var(--gold-line)] bg-[var(--panel)] text-[var(--ivory)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className={`text-xl font-semibold ${text}`}>
              {editing ? "Edit event" : "New event"}
            </DialogTitle>
          </DialogHeader>
          <EventForm
            event={editing}
            branches={showBranchPicker ? branches : undefined}
            tone={tone}
            onSaved={(saved) => {
              setEvents((prev) =>
                editing ? prev.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...prev]
              );
              setFormOpen(false);
              setEditing(undefined);
            }}
            onCancel={() => {
              setFormOpen(false);
              setEditing(undefined);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}