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
  tone: "admin" | "branch";
  showBranchPicker: boolean;
}) {
  const [events, setEvents] = useState<Event[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Event | undefined>();

  const isBranch = tone === "branch";

  const card = isBranch
    ? "border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    : "border-ink/8 bg-white shadow-[0_1px_3px_rgba(20,24,28,0.04)]";
  const text = isBranch ? "text-navy" : "text-ink";
  const muted = isBranch ? "text-slate-muted" : "text-ink-muted";
  const subtle = isBranch ? "text-slate-subtle" : "text-ink-muted";
  const primary = isBranch
    ? "bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
    : "bg-gold text-ink hover:bg-gold/90";
  const liveBadge = isBranch ? "bg-success-bg text-success" : "bg-sage-soft text-sage";
  const upcomingBadge = isBranch ? "bg-info-bg text-info" : "bg-teal-soft text-teal";
  const pastBadge = isBranch ? "bg-slate-bg text-slate-subtle" : "bg-ink/5 text-ink-muted";

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
        .then((list) => setBranches(list.map((b: any) => ({ id: b.id, name: b.name }))))
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
            <div
              className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-lg sm:h-28 sm:w-40 ${
                isBranch ? "bg-slate-bg" : "bg-ink/5"
              }`}
            >
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
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      isBranch ? "bg-purple-bg text-purple" : "bg-violet-soft text-violet"
                    }`}
                  >
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
                  isBranch ? "hover:bg-slate-bg" : "hover:bg-ink/5"
                }`}
              >
                <Pencil size={14} />
                Edit
              </button>

              <button
                onClick={() => togglePublished(event)}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs ${muted} ${
                  isBranch ? "hover:bg-slate-bg" : "hover:bg-ink/5"
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
                    isBranch ? "hover:bg-slate-bg" : "hover:bg-ink/5"
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
          className={`rounded-xl px-4 py-3 text-sm ${
            isBranch
              ? "border border-danger/25 bg-danger-bg text-danger"
              : "border border-ember/25 bg-ember-soft text-ember"
          }`}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className={`text-sm ${muted}`}>Loading…</p>
      ) : events.length === 0 ? (
        <div
          className={`rounded-xl border border-dashed px-6 py-16 text-center ${
            isBranch ? "border-slate-border" : "border-ink/15"
          }`}
        >
          <CalendarDays size={26} strokeWidth={1} className={`mx-auto ${muted}`} />
          <p className={`mt-3 text-sm ${muted}`}>
            No events yet. Create one and it'll appear on the website.
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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