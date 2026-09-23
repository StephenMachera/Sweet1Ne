"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { EmojiField } from "@/components/ui/emoji-field";
import { useMediaLibrary } from "@/lib/use-media-library";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addBlock,
  defaultPromotionLayout,
  heroImageOf,
  CTA_PRESETS,
  type PromotionBlock,
  type PromotionBlockType,
  type PromotionCtaKind,
} from "@/lib/promotion-blocks";
import { PromotionLayoutEditor, QuickGallery } from "./promotion-blocks-editor";
import { PromotionPreview } from "./promotion-preview";
import { AdminLoading } from "@/components/admin/admin-loading";

const DARK_DIALOG =
  "border border-[rgba(201,162,74,0.42)] bg-[#0c0c0c] text-[#e5e2e1] sm:max-w-md";
const DIALOG_BOOK_BTN =
  "inline-block rounded-[3px] border border-[rgba(201,162,74,0.9)] bg-transparent px-[1.15rem] py-[0.7rem] text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#c9a24a] hover:bg-[#c9a24a] hover:text-[#0e0e0e]";
const DIALOG_GHOST_BTN =
  "inline-block rounded-[3px] border border-[rgba(229,226,225,0.25)] bg-transparent px-[1.15rem] py-[0.7rem] text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#e5e2e1] hover:bg-[rgba(229,226,225,0.08)]";

type Branch = { id: string; name: string };
type Kind = "notice" | "invite" | "mail" | "code";
type Offer = "none" | "percent" | "pounds";
type Who = "all" | "quiet" | "regular";
type Surfaces = { enter: boolean; ribbon: boolean; phone: boolean; mail: boolean };
type Look = { still: string; tone: string; align: string };

type Promotion = {
  id: string;
  branch_id: string | null;
  kind: Kind;
  title: string;
  kicker: string | null;
  dek: string | null;
  cta: PromotionCtaKind;
  cta_label: string | null;
  code: string | null;
  offer: Offer;
  off: number | null;
  starts_at: string;
  ends_at: string | null;
  is_on: boolean;
  who: Who;
  quiet_days: number;
  regular_visits: number;
  surfaces: Surfaces;
  layout: PromotionBlock[];
  look: Look;
  map_id: string | null;
  created_at: string;
  updated_at: string;
};

type Draft = Omit<Promotion, "id" | "created_at" | "updated_at" | "is_on">;

const KINDS: { id: Kind; label: string; hint: string; surfaces: Surfaces }[] = [
  {
    id: "notice",
    label: "A notice",
    hint: "A general update or announcement — switch on wherever it fits below.",
    surfaces: { enter: true, ribbon: true, phone: true, mail: false },
  },
  {
    id: "invite",
    label: "An invite",
    hint: "An invitation to something coming up.",
    surfaces: { enter: true, ribbon: false, phone: false, mail: true },
  },
  {
    id: "mail",
    label: "A letter",
    hint: "Written for a letter — turn on other surfaces only if it fits there too.",
    surfaces: { enter: false, ribbon: false, phone: false, mail: true },
  },
  {
    id: "code",
    label: "A code",
    hint: "A real code. When it's live, the table phone shows the take-off computed from real menu prices.",
    surfaces: { enter: false, ribbon: false, phone: true, mail: false },
  },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(branchId: string | null): Draft {
  const defs = KINDS[0].surfaces;
  return {
    branch_id: branchId,
    kind: "notice",
    title: "",
    kicker: "Now",
    dek: "",
    cta: "book",
    cta_label: "",
    code: "",
    offer: "none",
    off: null,
    starts_at: todayISO(),
    ends_at: null,
    who: "all",
    quiet_days: 50,
    regular_visits: 4,
    surfaces: { ...defs },
    layout: defaultPromotionLayout(),
    look: { still: "left", tone: "glass", align: "left" },
    map_id: null,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function statusOf(p: Promotion): "live" | "ended" | "scheduled" | "draft" {
  const today = todayISO();
  if (!p.is_on) return "draft";
  if (p.ends_at && p.ends_at < today) return "ended";
  if (p.starts_at > today) return "scheduled";
  return "live";
}

function showsOf(p: Promotion): string {
  const bits: string[] = [];
  if (p.surfaces.enter) bits.push("Enter");
  if (p.surfaces.ribbon) bits.push("Line");
  if (p.surfaces.phone) bits.push("Phone");
  if (p.surfaces.mail) bits.push("Letter");
  return bits.join(" · ") || "—";
}

function whoOf(p: Promotion): string {
  if (p.who === "quiet") return `Away ${p.quiet_days}+ days`;
  if (p.who === "regular") return `${p.regular_visits}+ visits`;
  return "Anyone";
}

function kindLabel(kind: Kind): string {
  return KINDS.find((k) => k.id === kind)?.label ?? "A notice";
}

/** Seeds a Marketing draft from a promotion's own words — the marketer
   still has to paste real links onto any buttons and finish it in
   Marketing itself; this just saves retyping the copy. */
function toCampaignBlocks(p: Draft | Promotion) {
  const hasType = (t: PromotionBlockType) => p.layout.some((b) => b.type === t);
  const blocks: Record<string, unknown>[] = [];
  if (hasType("kicker") && p.kicker) blocks.push({ type: "eyebrow", text: p.kicker, align: "left" });
  if (hasType("title")) blocks.push({ type: "heading", text: p.title, size: "medium", align: "left" });
  if (hasType("dek") && p.dek) blocks.push({ type: "paragraph", text: p.dek, align: "left" });
  const hero = heroImageOf(p.layout);
  if (hero) blocks.push({ type: "image", url: hero.image_url, alt: "", full_width: false });
  for (const b of p.layout) {
    if (b.type === "note" && b.text) blocks.push({ type: "paragraph", text: b.text, align: "left" });
  }
  if (hasType("ctas")) {
    const preset = CTA_PRESETS[p.cta];
    blocks.push({ type: "button", label: p.cta_label || preset.label, url: "", align: "left" });
  }
  return blocks;
}

export function PromotionConsole({ branches, meEmail }: { branches: Branch[]; meEmail: string | null }) {
  const router = useRouter();
  const { media } = useMediaLibrary();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"board" | "look">("board");
  const [placeFilter, setPlaceFilter] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "live" | "draft" | "ended">("all");
  const [query, setQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft(null));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Promotion | null>(null);
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

  const load = useCallback(
    () =>
      apiFetch("/promotions")
        .then(setPromotions)
        .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load promotions."))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  function patch(fields: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...fields }));
  }

  function openAdd() {
    setEditingId(null);
    setDraft(emptyDraft(placeFilter || null));
    setFormOpen(true);
  }

  function openEdit(p: Promotion) {
    setEditingId(p.id);
    setDraft({
      branch_id: p.branch_id,
      kind: p.kind,
      title: p.title,
      kicker: p.kicker,
      dek: p.dek,
      cta: p.cta,
      cta_label: p.cta_label,
      code: p.code,
      offer: p.offer,
      off: p.off,
      starts_at: p.starts_at,
      ends_at: p.ends_at,
      who: p.who,
      quiet_days: p.quiet_days,
      regular_visits: p.regular_visits,
      surfaces: p.surfaces,
      layout: p.layout.length ? p.layout : defaultPromotionLayout(),
      look: p.look,
      map_id: p.map_id,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.starts_at) return;
    setSaving(true);
    setError(null);
    try {
      const body = { ...draft, off: draft.off || null, dek: draft.dek || null, kicker: draft.kicker || null, cta_label: draft.cta_label || null, code: draft.code || null, ends_at: draft.ends_at || null, map_id: draft.map_id || null };
      const saved = editingId
        ? await apiFetch(`/promotions/${editingId}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/promotions", { method: "POST", body: JSON.stringify(body) });
      setPromotions((prev) => (editingId ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]));
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleOn(p: Promotion) {
    if (!p.is_on && p.kind === "code" && !p.code) {
      setError("This code promotion needs a code before it can go live.");
      return;
    }
    setError(null);
    try {
      const updated = await apiFetch(`/promotions/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_on: !p.is_on }),
      });
      setPromotions((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change that.");
    }
  }

  async function remove(p: Promotion) {
    setConfirmDelete(null);
    setError(null);
    try {
      await apiFetch(`/promotions/${p.id}`, { method: "DELETE" });
      setPromotions((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that.");
    }
  }

  async function openInMarketing() {
    try {
      const created = await apiFetch("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: draft.title || "Untitled promotion",
          subject: draft.title || "Untitled promotion",
          preheader: draft.kicker || null,
          blocks: toCampaignBlocks(draft),
          audience: "active",
          map_id: draft.map_id || slugify(draft.title) || null,
        }),
      });
      router.push("/admin/marketing");
      void created;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start a draft in Marketing.");
    }
  }

  function matchesPlace(p: Promotion) {
    if (!placeFilter) return true;
    return p.branch_id === null || p.branch_id === placeFilter;
  }

  const visible = promotions
    .filter(matchesPlace)
    .filter((p) => stateFilter === "all" || statusOf(p) === stateFilter)
    .filter((p) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return `${p.title} ${p.dek ?? ""} ${p.kicker ?? ""} ${p.map_id ?? ""} ${p.code ?? ""}`.toLowerCase().includes(q);
    });

  const live = promotions.filter((p) => statusOf(p) === "live");
  const liveOnSurface = (s: keyof Surfaces) =>
    live.filter((p) => matchesPlace(p) && p.surfaces[s]).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  const campaignTag = `utm_campaign=${slugify(draft.map_id || draft.title) || "your-id"}`;

  if (loading) return <AdminLoading />;

  return (
    <>
      <div className="admin-top">
        <div className="admin-places" role="group" aria-label="Restaurant">
          <button type="button" className={placeFilter === "" ? "is-on" : undefined} onClick={() => setPlaceFilter("")}>
            Both
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={placeFilter === b.id ? "is-on" : undefined}
              onClick={() => setPlaceFilter(placeFilter === b.id ? "" : b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
        <p className="admin-who">{meEmail ?? "—"}</p>
      </div>

      <h1>Promotions</h1>
      <p className="admin-dek">
        Board is the list. Look is how it sits. Switch a promotion on from the list — a code
        promotion needs a real code first.
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <div className="admin-kpi-strip" aria-label="Summary">
        <div>
          <span className="admin-kpi-n">{live.length}</span>
          <span className="admin-kpi-l">Live</span>
        </div>
        <div>
          <span className="admin-kpi-n">{live.filter((p) => p.surfaces.enter).length}</span>
          <span className="admin-kpi-l">After they enter</span>
        </div>
        <div>
          <span className="admin-kpi-n">{live.filter((p) => p.surfaces.phone).length}</span>
          <span className="admin-kpi-l">On the phone</span>
        </div>
        <div>
          <span className="admin-kpi-n">{live.filter((p) => p.surfaces.mail).length}</span>
          <span className="admin-kpi-l">Letters</span>
        </div>
      </div>

      <div className="admin-cats" role="group" aria-label="View">
        <button type="button" className={view === "board" ? "is-on" : undefined} onClick={() => setView("board")}>
          Board
        </button>
        <button type="button" className={view === "look" ? "is-on" : undefined} onClick={() => setView("look")}>
          Look
        </button>
      </div>

      {view === "board" ? (
        <>
          <div className="admin-cats" role="group" aria-label="Status">
            {(["all", "live", "draft", "ended"] as const).map((s) => (
              <button key={s} type="button" className={stateFilter === s ? "is-on" : undefined} onClick={() => setStateFilter(s)}>
                {s === "all" ? "All" : s === "live" ? "Live" : s === "draft" ? "Draft" : "Ended"}
              </button>
            ))}
          </div>

          <div className="admin-tools">
            <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="button" className="admin-book" onClick={openAdd}>
              Add promotion
            </button>
          </div>

          {visible.length === 0 ? (
            <p className="admin-empty">No promotions. Add one when a real offer exists.</p>
          ) : (
            <div className="admin-data-panel">
              <table className="admin-sheet">
                <thead>
                  <tr>
                    <th>On</th>
                    <th>Promotion</th>
                    <th>Purpose</th>
                    <th>Shows</th>
                    <th>Who</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const st = statusOf(p);
                    return (
                      <tr key={p.id}>
                        <td>
                          <button
                            type="button"
                            aria-label="On"
                            className={`admin-toggle${p.is_on ? " is-on" : ""}`}
                            onClick={() => toggleOn(p)}
                          />
                        </td>
                        <td>
                          <span className="admin-name">{p.title}</span>
                          {p.code && <div className="admin-muted">{p.code}</div>}
                        </td>
                        <td className="admin-muted">{kindLabel(p.kind)}</td>
                        <td className="admin-muted">{showsOf(p)}</td>
                        <td className="admin-muted">{whoOf(p)}</td>
                        <td>
                          <span
                            className={`admin-status${st === "draft" || st === "scheduled" ? " is-wait" : st === "live" ? " is-ok" : ""}`}
                          >
                            {st === "live" ? "Live" : st === "ended" ? "Ended" : st === "scheduled" ? "Scheduled" : "Draft"}
                          </span>
                        </td>
                        <td className="admin-row-acts">
                          <button type="button" className="admin-edit" onClick={() => openEdit(p)}>
                            Edit
                          </button>
                          <button type="button" className="admin-edit" onClick={() => setConfirmDelete(p)}>
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
        </>
      ) : (
        <>
          <p className="admin-dek">Guest view of whatever is live right now on each surface.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["enter", "After they enter", "Homepage, after Enter Sweet1NE."],
                ["ribbon", "Quiet line", "Under the header until they close it."],
                ["phone", "Table phone", "After the menu, on the guest's own phone."],
                ["mail", "A letter", "Marketing, people who asked."],
              ] as [keyof Surfaces, string, string][]
            ).map(([key, label, cap]) => {
              const p = liveOnSurface(key);
              return (
                <article key={key} className="admin-card">
                  <h2>
                    {label} <span className="text-[var(--ivory-dim)]">{p ? "Live" : "Off"}</span>
                  </h2>
                  <p className="admin-dek">{cap}</p>
                  {p ? (
                    <PromotionPreview data={p} />
                  ) : (
                    <p className="admin-empty">Nothing live here.</p>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}

      {formOpen &&
        drawerSlot &&
        createPortal(
          <aside className="admin-drawer-edit is-builder">
            <h2>{editingId ? "Edit promotion" : "Add promotion"}</h2>
            <p className="admin-dek">Purpose first. Look updates as you go.</p>

            <div className="mb-3">
              <PromotionPreview data={draft} />
            </div>

            <form onSubmit={save} className="admin-form">
              <fieldset disabled={saving} className="contents">
                <div className="admin-cats" role="group" aria-label="Purpose">
                  {KINDS.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      className={draft.kind === k.id ? "is-on" : undefined}
                      onClick={() =>
                        patch({
                          kind: k.id,
                          surfaces: k.surfaces,
                          cta: k.id === "invite" ? "join" : k.id === "code" ? draft.cta : "book",
                        })
                      }
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
                <p className="admin-dek">{KINDS.find((k) => k.id === draft.kind)?.hint}</p>

                <label>
                  Title
                  <EmojiField value={draft.title} onChange={(title) => patch({ title })} placeholder="Table for two?" required />
                </label>
                <label>
                  Kicker
                  <EmojiField value={draft.kicker ?? ""} onChange={(kicker) => patch({ kicker })} placeholder="Now" />
                </label>
                <label>
                  Copy
                  <EmojiField value={draft.dek ?? ""} onChange={(dek) => patch({ dek })} multiline />
                </label>

                <div className="admin-row">
                  <label>
                    Button
                    <select value={draft.cta} onChange={(e) => patch({ cta: e.target.value as PromotionCtaKind })}>
                      <option value="book">Book a table</option>
                      <option value="find">Find Us</option>
                      <option value="menu">The menu</option>
                      <option value="events">Events</option>
                      <option value="contact">Write to us</option>
                      <option value="order">Order</option>
                      <option value="join">Join the list</option>
                    </select>
                  </label>
                  <label>
                    Button words
                    <input
                      value={draft.cta_label ?? ""}
                      onChange={(e) => patch({ cta_label: e.target.value })}
                      placeholder={CTA_PRESETS[draft.cta].label}
                    />
                  </label>
                </div>

                {draft.kind === "code" && (
                  <div className="admin-row">
                    <label>
                      Code
                      <input
                        value={draft.code ?? ""}
                        onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
                        placeholder="Type the real code"
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      Takes off
                      <select value={draft.offer} onChange={(e) => patch({ offer: e.target.value as Offer })}>
                        <option value="none">The code is the offer</option>
                        <option value="percent">A percent of the basket</option>
                        <option value="pounds">Pounds off the basket</option>
                      </select>
                    </label>
                    {draft.offer !== "none" && (
                      <label>
                        How much
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.off ?? ""}
                          onChange={(e) => patch({ off: e.target.value ? Number(e.target.value) : null })}
                        />
                      </label>
                    )}
                  </div>
                )}

                <p className="admin-kicker">Show on</p>
                <div className="admin-row" style={{ flexWrap: "wrap" }}>
                  {(
                    [
                      ["enter", "After they enter"],
                      ["ribbon", "Quiet line"],
                      ["phone", "Table phone"],
                      ["mail", "A letter"],
                    ] as [keyof Surfaces, string][]
                  ).map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={draft.surfaces[key]}
                        onChange={(e) => patch({ surfaces: { ...draft.surfaces, [key]: e.target.checked } })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <label>
                  Who sees this
                  <select value={draft.who} onChange={(e) => patch({ who: e.target.value as Who })}>
                    <option value="all">Anyone on that surface</option>
                    <option value="quiet">Not at a table for a while</option>
                    <option value="regular">People who come often</option>
                  </select>
                </label>
                {draft.who !== "all" && (
                  <div className="admin-row">
                    <label>
                      Days away
                      <input
                        type="number"
                        min="1"
                        value={draft.quiet_days}
                        onChange={(e) => patch({ quiet_days: Number(e.target.value) })}
                        disabled={draft.who !== "quiet"}
                      />
                    </label>
                    <label>
                      Visits
                      <input
                        type="number"
                        min="2"
                        value={draft.regular_visits}
                        onChange={(e) => patch({ regular_visits: Number(e.target.value) })}
                        disabled={draft.who !== "regular"}
                      />
                    </label>
                  </div>
                )}

                <p className="admin-kicker">Picture</p>
                <QuickGallery media={media} layout={draft.layout} onChange={(layout) => patch({ layout })} />
                <div className="admin-row">
                  <label>
                    Place
                    <select
                      value={draft.branch_id ?? ""}
                      onChange={(e) => patch({ branch_id: e.target.value || null })}
                    >
                      <option value="">Both</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tone
                    <select value={draft.look.tone} onChange={(e) => patch({ look: { ...draft.look, tone: e.target.value } })}>
                      <option value="glass">Glass</option>
                      <option value="solid">Solid</option>
                    </select>
                  </label>
                  <label>
                    Align
                    <select value={draft.look.align} onChange={(e) => patch({ look: { ...draft.look, align: e.target.value } })}>
                      <option value="left">Left</option>
                      <option value="center">Centre</option>
                    </select>
                  </label>
                </div>
                <label>
                  Picture placement
                  <select value={draft.look.still} onChange={(e) => patch({ look: { ...draft.look, still: e.target.value } })}>
                    <option value="left">Beside the words</option>
                    <option value="top">Above the words</option>
                    <option value="none">Words only</option>
                  </select>
                </label>

                <details className="admin-drawer-fold">
                  <summary>Pieces</summary>
                  <p className="admin-dek">Add, move or remove bits. Emoji appear when you type.</p>
                  <div className="admin-bit-bar" role="group" aria-label="Add a bit">
                    {(["logo", "kicker", "title", "dek", "image", "note", "ctas"] as PromotionBlockType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="admin-add-bit"
                        onClick={() => patch({ layout: addBlock(draft.layout, t) })}
                      >
                        + {t === "dek" ? "Copy" : t === "ctas" ? "Buttons" : t === "image" ? "Picture" : t[0].toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  <PromotionLayoutEditor media={media} layout={draft.layout} onChange={(layout) => patch({ layout })} />
                </details>

                <details className="admin-drawer-fold">
                  <summary>When and tags</summary>
                  <div className="admin-row">
                    <label>
                      From
                      <input
                        type="date"
                        required
                        value={draft.starts_at}
                        onChange={(e) => patch({ starts_at: e.target.value })}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                      />
                    </label>
                    <label>
                      To
                      <input
                        type="date"
                        value={draft.ends_at ?? ""}
                        onChange={(e) => patch({ ends_at: e.target.value || null })}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                      />
                    </label>
                  </div>
                  <label>
                    Campaign ID
                    <input
                      value={draft.map_id ?? ""}
                      onChange={(e) => patch({ map_id: e.target.value })}
                      placeholder="a-table-this-weekend"
                    />
                  </label>
                  <div className="admin-row-acts">
                    <span className="admin-muted">On the tags: {campaignTag}</span>
                    <button
                      type="button"
                      className="admin-edit"
                      onClick={() => navigator.clipboard?.writeText(campaignTag)}
                    >
                      Copy
                    </button>
                  </div>
                </details>

                <p className="admin-row-acts">
                  <button type="submit" className="admin-book">
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button type="button" className="admin-book" onClick={closeForm}>
                    Close
                  </button>
                  <button type="button" className="admin-edit" onClick={openInMarketing}>
                    Open in Marketing
                  </button>
                </p>
              </fieldset>
            </form>
          </aside>,
          drawerSlot
        )}

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className={DARK_DIALOG}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#e5e2e1]">Remove this promotion?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#a8a4a2]">
            {confirmDelete?.title} will stop showing everywhere it&apos;s live, right away.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={DIALOG_GHOST_BTN} onClick={() => setConfirmDelete(null)}>
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
