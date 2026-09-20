"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { EventForm, emptyAdminDraft, type AdminEventDraft, type Event } from "@/components/events/event-form";
import {
  heroImageOf,
  type EventBlock,
  type EventBlockType,
  type EventCta,
  type ImageBlock,
  type LogoBlock,
  type NoteBlock,
} from "@/components/events/event-blocks";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Literal colors, not var(--gold-line) etc — Dialog portals to
// document.body, outside .admin-shell, so those custom properties (only
// defined under that class) don't cascade here and the panel, its text
// and its .admin-book buttons would all render uncolored without them.
const DARK_DIALOG =
  "border border-[rgba(201,162,74,0.42)] bg-[#0c0c0c] text-[#e5e2e1] sm:max-w-md";
const DIALOG_BOOK_BTN =
  "inline-block rounded-[3px] border border-[rgba(201,162,74,0.9)] bg-transparent px-[1.15rem] py-[0.7rem] text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#c9a24a] hover:bg-[#c9a24a] hover:text-[#0e0e0e]";

type Place = "both" | "lewisham" | "chingford";
type StateFilter = "all" | "listed" | "draft" | "past";
type Branch = { id: string; name: string };

const EMPTY_STILL = "/images/homepage-gallery/events/poster-events.jpg";
// The site wordmark itself, not a media library row — same as the
// reference's own SWEET1NE_MEDIA.LOGO constant, kept separate from the
// general library of staff-added photos/GIFs/films.
const LOGO_SRC = "/images/homepage-gallery/story/logo.png";
const LOGO_WIDTH: Record<LogoBlock["size"], string> = { s: "4.6rem", m: "7.2rem", l: "10.5rem" };

type PreviewData = {
  title: string;
  tagline: string;
  description: string;
  layout: EventBlock[];
  ctas: EventCta[];
  metaLine: string;
};

/** Mirrors the reference's drawPreview(): layout blocks only turn each
   piece on or off (and supply image/note/logo content) — the rendered
   order itself is fixed, not driven by the blocks' order in the editor. */
function PreviewBody({ data }: { data: PreviewData }) {
  const hasType = (t: EventBlockType) => data.layout.some((b) => b.type === t);
  const images = data.layout.filter((b): b is ImageBlock => b.type === "image" && Boolean(b.image_url));
  const hero = images.find((b) => b.hero) ?? images[0];
  const extras = images.filter((b) => b !== hero);
  const notes = data.layout.filter((b): b is NoteBlock => b.type === "note" && Boolean(b.text));
  const logo = data.layout.find((b): b is LogoBlock => b.type === "logo");

  return (
    <>
      {logo && LOGO_SRC && (
        <img src={LOGO_SRC} alt="Sweet1NE" style={{ width: LOGO_WIDTH[logo.size], marginBottom: "0.7rem" }} />
      )}
      {hasType("kicker") && <p className="admin-kicker">{data.tagline || "What's next"}</p>}
      {hasType("meta") && data.metaLine && <p className="admin-preview-meta">{data.metaLine}</p>}
      {hasType("title") && <h2>{data.title || "Title sits here."}</h2>}
      {hasType("dek") && (
        <p className="admin-dek">{data.description || "Write the night. Guests see this on What's next."}</p>
      )}
      {notes.map((n) => (
        <p key={n.id} className="admin-preview-note">
          {n.text}
        </p>
      ))}
      {extras.length > 0 && (
        <div className="admin-preview-extras">
          {extras.map((b) => (
            <img key={b.id} src={b.image_url} alt="" />
          ))}
        </div>
      )}
      {hasType("ctas") && data.ctas.length > 0 && (
        <div className="admin-preview-ctas">
          {data.ctas.map((c, i) => (
            <a key={i} className="admin-book" href={c.href}>
              {c.label}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function statusOf(event: Event): "listed" | "draft" | "past" {
  if (!event.is_published) return "draft";
  const ends = new Date(event.ends_at ?? event.starts_at).getTime();
  if (ends < Date.now()) return "past";
  return "listed";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminEventsPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const canManage = hasPermission(me, "manage_promotions");

  const [events, setEvents] = useState<Event[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [place, setPlace] = useState<Place>("both");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Event | undefined>();
  const [draft, setDraft] = useState<AdminEventDraft>(emptyAdminDraft());
  const [confirmDelete, setConfirmDelete] = useState<Event | null>(null);
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

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
    apiFetch("/branches")
      .then((list: { id: string; name: string }[]) => setBranches(list.map((b) => ({ id: b.id, name: b.name }))))
      .catch(() => setBranches([]));
  }, [load]);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) router.replace("/admin/dashboard");
  }, [meLoading, me, canManage, router]);

  function openAdd() {
    setEditing(undefined);
    setDraft(emptyAdminDraft());
    setFormOpen(true);
  }

  function openEdit(event: Event) {
    setEditing(event);
    setDraft(emptyAdminDraft(event));
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(undefined);
  }

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

  async function remove(event: Event) {
    setConfirmDelete(null);
    setError(null);
    try {
      // The backend unpublishes rather than hard-deletes (a shared night's
      // URL may still be held by a guest) — reflect that here instead of
      // dropping the row, or it would reappear as a Draft on next reload.
      await apiFetch(`/events/${event.id}`, { method: "DELETE" });
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, is_published: false } : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that night.");
    }
  }

  if (meLoading || !me || !canManage) {
    return <p className="text-sm text-[var(--ivory-dim)]">Loading…</p>;
  }

  function matchesPlace(event: Event) {
    if (place === "both") return true;
    if (event.branch_id === null) return true;
    const branch = branches.find((b) => b.id === event.branch_id);
    return branch?.name.toLowerCase() === place;
  }

  const visible = events
    .filter(matchesPlace)
    .filter((e) => stateFilter === "all" || statusOf(e) === stateFilter)
    .filter((e) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return `${e.title} ${e.description ?? ""}`.toLowerCase().includes(q);
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const listedCount = events.filter((e) => statusOf(e) === "listed").length;

  const nextListed = events
    .filter((e) => statusOf(e) === "listed" && matchesPlace(e))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];

  const STATES: { key: StateFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "listed", label: "Listed" },
    { key: "draft", label: "Draft" },
    { key: "past", label: "Past" },
  ];

  return (
    <>
      <div className="admin-top">
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

      <h1>Events</h1>
      <p className="admin-dek">{listedCount} listed</p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      {/* Live while adding/editing — shows the draft's blocks instead of
          what's actually on the website. */}
      <section className="admin-preview-next" aria-label="On the website">
        <div className="admin-preview-hero">
          <img
            src={
              (formOpen ? heroImageOf(draft.layout)?.image_url : heroImageOf(nextListed?.layout ?? [])?.image_url) ||
              EMPTY_STILL
            }
            alt=""
          />
        </div>
        <div className="admin-preview-copy">
          {formOpen ? (
            <PreviewBody
              data={{
                title: draft.title,
                tagline: draft.tagline,
                description: draft.description,
                layout: draft.layout,
                ctas: draft.ctas,
                metaLine: draft.startsAt ? `${formatDate(draft.startsAt)} · ${formatTime(draft.startsAt)}` : "",
              }}
            />
          ) : nextListed ? (
            <PreviewBody
              data={{
                title: nextListed.title,
                tagline: nextListed.tagline ?? "",
                description: nextListed.description ?? "",
                layout: nextListed.layout,
                ctas: nextListed.ctas,
                metaLine: `${formatDate(nextListed.starts_at)} · ${formatTime(nextListed.starts_at)} · ${
                  nextListed.branch_name ?? "Both branches"
                }`,
              }}
            />
          ) : (
            <>
              <p className="admin-kicker">What&rsquo;s next</p>
              <h2>Nothing listed yet.</h2>
              <p className="admin-dek">
                When a night is on, it will sit here. More than one listed night rotates on the website.
              </p>
            </>
          )}
        </div>
      </section>

      <div className="admin-cats" role="group" aria-label="Status">
        {STATES.map((s) => (
          <button
            key={s.key}
            type="button"
            className={stateFilter === s.key ? "is-on" : undefined}
            onClick={() => setStateFilter(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="admin-tools">
        <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="admin-book" onClick={openAdd}>
          Add night
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--ivory-dim)]">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="admin-empty">
          No nights listed. Public What&rsquo;s next stays empty until you add one. If more than one is
          listed, the website rotates them.
        </p>
      ) : (
        <div className="admin-data-panel">
          <table className="admin-sheet">
            <thead>
              <tr>
                <th>On</th>
                <th>Date</th>
                <th>Night</th>
                <th>Restaurant</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((event) => {
                const st = statusOf(event);
                return (
                  <tr key={event.id}>
                    <td>
                      <button
                        type="button"
                        aria-label="On"
                        className={`admin-toggle${event.is_published ? " is-on" : ""}`}
                        onClick={() => togglePublished(event)}
                      />
                    </td>
                    <td className="admin-muted">{formatDate(event.starts_at)}</td>
                    <td>
                      <span className="admin-name">{event.title}</span>
                      <div className="admin-muted">{formatTime(event.starts_at)}</div>
                    </td>
                    <td className="admin-muted">{event.branch_name ?? "Both"}</td>
                    <td>
                      <span className={`admin-status${st === "draft" ? " is-wait" : st === "listed" ? " is-ok" : ""}`}>
                        {st === "listed" ? "Listed" : st === "draft" ? "Draft" : "Past"}
                      </span>
                    </td>
                    <td className="admin-row-acts">
                      <button type="button" className="admin-edit" onClick={() => openEdit(event)}>
                        Edit
                      </button>
                      <button type="button" className="admin-edit" onClick={() => setConfirmDelete(event)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor — portaled into the third grid column owned by the shared
          /admin layout. See #admin-drawer-slot in admin/layout.tsx. */}
      {formOpen &&
        drawerSlot &&
        createPortal(
          <aside className="admin-drawer-edit is-builder">
            <h2>{editing ? "Edit night" : "Add night"}</h2>
            <p className="admin-dek">What&rsquo;s next updates as you go.</p>
            <EventForm
              tone="admin"
              event={editing}
              branches={branches}
              draft={draft}
              onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              onSaved={(saved) => {
                setEvents((prev) => (editing ? prev.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...prev]));
                closeForm();
              }}
              onCancel={closeForm}
            />
          </aside>,
          drawerSlot
        )}

      {/* Delete confirmation */}
      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className={DARK_DIALOG}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#e5e2e1]">
              Remove {confirmDelete?.title}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[rgba(229,226,225,0.68)]">
            This takes the night off the public What&rsquo;s next. You can turn it back on from
            the Draft filter any time — its page and link stay intact.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className={DIALOG_BOOK_BTN} onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button type="button" className={DIALOG_BOOK_BTN} onClick={() => confirmDelete && remove(confirmDelete)}>
              Remove
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
