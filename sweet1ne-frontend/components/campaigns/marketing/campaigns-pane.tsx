"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Heading as HeadingIcon,
  ImageIcon,
  Link2,
  Minus,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useMediaLibrary, mediaThumb } from "@/lib/use-media-library";
import { EmojiField } from "@/components/ui/emoji-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const MEDIA_PAGE_SIZE = 9;

// The delete/test/send dialogs are portaled by @base-ui to document.body,
// outside .admin-shell — var(--x) tokens don't cascade there, so literal
// hex/rgba values are used instead (same fix as the other admin dialogs).
const DARK_DIALOG = "border border-[rgba(201,162,74,0.42)] bg-[#0c0c0c] text-[#e5e2e1] sm:max-w-sm";
const DIALOG_BOOK_BTN =
  "inline-flex items-center justify-center rounded-[3px] border border-[rgba(201,162,74,0.9)] bg-transparent px-[1.15rem] py-[0.6rem] text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#c9a24a] hover:bg-[#c9a24a] hover:text-[#0e0e0e] disabled:opacity-50";
const DIALOG_GHOST_BTN =
  "px-[1.15rem] py-[0.6rem] text-[0.75rem] uppercase tracking-[0.1em] text-[rgba(229,226,225,0.68)] hover:text-[#e5e2e1]";
const DIALOG_FIELD = "border-[rgba(201,162,74,0.35)] bg-[#050505] text-[#e5e2e1]";

type Channels = { google?: boolean; meta?: boolean; instagram?: boolean };

type Campaign = {
  id: string;
  name: string;
  subject: string;
  preheader?: string | null;
  blocks?: Block[];
  status: string;
  audience: string;
  channels: Channels;
  map_id: string | null;
  sent_at: string | null;
  sent_count: number;
  failed_count: number;
  updated_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sending: "Sending…",
  sent: "Sent",
  failed: "Failed",
};

const AUDIENCE_LABELS: Record<string, string> = {
  active: "Active",
  website: "Website",
  booking: "Bookings",
};

type Block = Record<string, any> & { type: string };
type CtaItem = { kind: string; label: string; href: string };

type CampaignCtaKind = "book" | "menu" | "order";
const CTA_PRESETS: Record<CampaignCtaKind, string> = {
  book: "Book",
  menu: "Menu",
  order: "Order",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const BLOCK_KINDS: { type: string; label: string; icon: typeof Type; make: () => Block }[] = [
  { type: "logo", label: "Logo", icon: ImageIcon, make: () => ({ type: "logo", size: "m", align: "center" }) },
  { type: "kicker", label: "Kicker", icon: Type, make: () => ({ type: "kicker", text: "" }) },
  { type: "heading", label: "Title", icon: HeadingIcon, make: () => ({ type: "heading", text: "", size: "medium", align: "left" }) },
  { type: "paragraph", label: "Copy", icon: Type, make: () => ({ type: "paragraph", text: "", align: "left" }) },
  { type: "image", label: "Picture", icon: ImageIcon, make: () => ({ type: "image", url: "", alt: "", full_width: false }) },
  { type: "note", label: "Note", icon: Type, make: () => ({ type: "note", text: "" }) },
  { type: "ctas", label: "Buttons", icon: Link2, make: () => ({ type: "ctas", items: [{ kind: "book", label: "Book", href: "" }] }) },
  { type: "slogan", label: "Slogan", icon: Type, make: () => ({ type: "slogan", text: "Always in the mood for you." }) },
  { type: "button", label: "Button", icon: Link2, make: () => ({ type: "button", label: "", url: "", align: "left" }) },
  { type: "divider", label: "Divider", icon: Minus, make: () => ({ type: "divider" }) },
];

/**
 * Campaigns tab of the unified /admin/marketing page. Creating or editing a
 * campaign opens the #admin-drawer-slot drawer (same slide-in pattern as
 * tables/staff/roles) and, while editing, the campaigns table in the main
 * column is replaced by a live preview — a real rendered-email iframe from
 * the same /campaigns/preview endpoint the Preview dialog used to use, so
 * it can never drift from what actually gets sent.
 */
export function CampaignsPane() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  const load = useCallback(
    () =>
      apiFetch("/campaigns")
        .then(setCampaigns)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

  async function createDraft() {
    setCreating(true);
    setError(null);
    try {
      const draft = await apiFetch("/campaigns", {
        method: "POST",
        body: JSON.stringify({ name: "Untitled campaign", subject: "", preheader: null, blocks: [] }),
      });
      setCampaigns((prev) => [draft, ...prev]);
      setEditingId(draft.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that.");
    } finally {
      setCreating(false);
    }
  }

  async function duplicate(campaign: Campaign) {
    setError(null);
    try {
      const copy = await apiFetch(`/campaigns/${campaign.id}/duplicate`, { method: "POST" });
      setCampaigns((prev) => [copy, ...prev]);
      setEditingId(copy.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't duplicate that.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiFetch(`/campaigns/${deleting.id}`, { method: "DELETE" });
      setCampaigns((prev) => prev.filter((c) => c.id !== deleting.id));
      setDeleting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that.");
      setDeleting(null);
    }
  }

  const drafts = campaigns.filter((c) => c.status === "draft");
  const sent = campaigns.filter((c) => c.status !== "draft");
  const editing = editingId !== null;

  return (
    <>
      <p className="admin-dek">
        {drafts.length} in progress · {sent.length} sent
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <div className="admin-tools">
        <button type="button" className="admin-book ml-auto" onClick={createDraft} disabled={creating}>
          {creating ? "Creating…" : "New campaign"}
        </button>
      </div>

      {editing ? (
        <LivePreview id={editingId!} />
      ) : loading ? (
        <p className="text-sm text-[var(--ivory-dim)]">Loading…</p>
      ) : campaigns.length === 0 ? (
        <p className="admin-empty">
          No campaigns yet. Build an email from blocks — a heading, some text, a picture, a
          button. It&rsquo;ll come out looking like Sweet1NE whatever you write.
        </p>
      ) : (
        <>
          {drafts.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[var(--ivory-dim)]">
                In progress
              </p>
              <div className="admin-data-panel">
                <table className="admin-sheet">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Subject</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((campaign) => (
                      <CampaignRow
                        key={campaign.id}
                        campaign={campaign}
                        onEdit={() => setEditingId(campaign.id)}
                        onDuplicate={() => duplicate(campaign)}
                        onDelete={() => setDeleting(campaign)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sent.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[var(--ivory-dim)]">
                Sent
              </p>
              <div className="admin-data-panel">
                <table className="admin-sheet">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Subject</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sent.map((campaign) => (
                      <CampaignRow
                        key={campaign.id}
                        campaign={campaign}
                        onEdit={() => setEditingId(campaign.id)}
                        onDuplicate={() => duplicate(campaign)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className={DARK_DIALOG}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#e5e2e1]">
              Delete this draft?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-[rgba(229,226,225,0.68)]">
              &ldquo;{deleting?.name}&rdquo; will be gone for good.
            </p>

            <div className="flex justify-end gap-3">
              <button type="button" className={DIALOG_GHOST_BTN} onClick={() => setDeleting(null)}>
                Keep it
              </button>
              <button type="button" className={DIALOG_BOOK_BTN} onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor — portaled into the third grid column owned by the shared
          /admin layout, same as menu, events, tables, staff, roles and
          inbox. See #admin-drawer-slot in admin/layout.tsx. */}
      {editingId &&
        drawerSlot &&
        createPortal(
          <CampaignEditorDrawer
            id={editingId}
            onClose={() => setEditingId(null)}
            onSaved={(updated) =>
              setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
            }
          />,
          drawerSlot
        )}
    </>
  );
}

function CampaignRow({
  campaign,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  campaign: Campaign;
  onEdit: () => void;
  onDuplicate: () => void;
  /** Only drafts can be deleted — a sent campaign is the record of what
   *  actually went to customers. */
  onDelete?: () => void;
}) {
  const statusCls: Record<string, string> = {
    draft: "admin-status",
    sending: "admin-status is-wait",
    sent: "admin-status is-ok",
    failed: "admin-status is-wait",
  };

  return (
    <tr>
      <td>
        <span className="admin-name">{campaign.name}</span>
      </td>
      <td className="admin-muted">{campaign.subject || "No subject yet"}</td>
      <td>
        <span className={statusCls[campaign.status]}>
          {STATUS_LABELS[campaign.status] ?? campaign.status}
        </span>
        <div className="admin-muted">
          {campaign.sent_at ? (
            <>
              Sent{" "}
              {new Date(campaign.sent_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              to {campaign.sent_count} {campaign.sent_count === 1 ? "person" : "people"}
              {campaign.failed_count > 0 && ` · ${campaign.failed_count} failed`}
            </>
          ) : (
            <>
              Last edited{" "}
              {new Date(campaign.updated_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </>
          )}
        </div>
      </td>
      <td>
        <div className="flex gap-3">
          <button type="button" className="admin-edit" onClick={onDuplicate}>
            <Copy size={14} />
          </button>
          {onDelete && (
            <button type="button" className="admin-edit" onClick={onDelete}>
              <Trash2 size={14} />
            </button>
          )}
          <button type="button" className="admin-edit" onClick={onEdit}>
            {campaign.status === "draft" ? "Edit" : "View"}
          </button>
        </div>
      </td>
    </tr>
  );
}

/** Live preview replacing the table while a campaign is open for editing.
 *  Renders the SAME html the real send/test-send would produce (fetched
 *  from /campaigns/preview), just re-fetched on a short debounce as the
 *  draft changes — kept in its own component so its polling doesn't cause
 *  the drawer's own state/effects to re-run. */
function LivePreview({ id }: { id: string }) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function fetchOnce(payload: { name: string; subject: string; preheader: string | null; blocks: Block[] }) {
      apiFetch("/campaigns/preview", { method: "POST", body: JSON.stringify(payload) })
        .then(({ html }) => !cancelled && setHtml(html))
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    }

    // The drawer owns the actual draft state — reading the campaign fresh
    // on a short poll is simpler than threading live form state through a
    // portal boundary, and a couple-hundred-ms lag is invisible here.
    function poll() {
      apiFetch(`/campaigns/${id}`)
        .then((c) => fetchOnce({ name: c.name, subject: c.subject, preheader: c.preheader, blocks: c.blocks ?? [] }))
        .catch(() => setLoading(false));
    }

    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  return (
    <div className="admin-mail-preview">
      {loading && !html ? (
        <p className="p-6 text-sm text-[var(--ivory-dim)]">Rendering…</p>
      ) : (
        <iframe title="Campaign preview" srcDoc={html} />
      )}
    </div>
  );
}

function CampaignEditorDrawer({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: (campaign: Campaign) => void;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [audience, setAudience] = useState("active");
  const [channels, setChannels] = useState<Channels>({});
  const [mapId, setMapId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testEmail, setTestEmail] = useState("");
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const [subscriberStats, setSubscriberStats] = useState<{
    subscribed: number;
    from_website: number;
    from_reservations: number;
  } | null>(null);

  const readOnly = campaign ? ["sent", "sending"].includes(campaign.status) : false;

  useEffect(() => {
    apiFetch(`/campaigns/${id}`)
      .then((c: Campaign) => {
        setCampaign(c);
        setName(c.name);
        setSubject(c.subject);
        setPreheader(c.preheader ?? "");
        setBlocks(c.blocks ?? []);
        setAudience(c.audience ?? "active");
        setChannels(c.channels ?? {});
        setMapId(c.map_id ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load that campaign."))
      .finally(() => setLoading(false));

    apiFetch("/newsletter/stats")
      .then(setSubscriberStats)
      .catch(() => setSubscriberStats(null));
  }, [id]);

  function updateBlock(index: number, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function addBlock(make: () => Block) {
    setBlocks((prev) => [...prev, make()]);
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          subject,
          preheader: preheader || null,
          blocks,
          audience,
          channels,
          map_id: mapId || null,
        }),
      });
      setCampaign(updated);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testEmail) return;
    setSendingTest(true);
    setError(null);
    try {
      await apiFetch(`/campaigns/${id}/test`, { method: "POST", body: JSON.stringify({ email: testEmail }) });
      setTestDialogOpen(false);
      setTestEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that test.");
    } finally {
      setSendingTest(false);
    }
  }

  async function confirmSend() {
    setSending(true);
    setError(null);
    try {
      const updated = await apiFetch(`/campaigns/${id}/send`, { method: "POST" });
      setCampaign(updated);
      onSaved(updated);
      setSendDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.");
    } finally {
      setSending(false);
    }
  }

  const audienceCount = subscriberStats
    ? audience === "website"
      ? subscriberStats.from_website
      : audience === "booking"
        ? subscriberStats.from_reservations
        : subscriberStats.subscribed
    : null;

  const campaignTag = `utm_campaign=${slugify(mapId || subject || name) || "your-id"}`;

  return (
    <aside className="admin-drawer-edit is-wide">
      {loading || !campaign ? (
        <p className="text-sm text-[var(--ivory-dim)]">Loading…</p>
      ) : (
        <>
          <div className="mb-1 flex items-start justify-between gap-3">
            <h2 className="min-w-0 truncate">{name || "Untitled campaign"}</h2>
            <button type="button" className="admin-edit shrink-0" onClick={onClose}>
              Close
            </button>
          </div>
          <p className="admin-dek">
            {campaign.status === "sent"
              ? `Sent to ${campaign.sent_count} ${campaign.sent_count === 1 ? "person" : "people"}${campaign.failed_count > 0 ? ` · ${campaign.failed_count} failed` : ""}`
              : readOnly
                ? "Sending…"
                : "Draft"}
          </p>

          <div className="mb-4 flex flex-wrap gap-2">
            {!readOnly && (
              <>
                <button type="button" className="admin-book" onClick={() => setTestDialogOpen(true)}>
                  Send test
                </button>
                <button type="button" className="admin-book" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
                {campaign.status !== "sent" && (
                  <button
                    type="button"
                    className="admin-book"
                    onClick={() => setSendDialogOpen(true)}
                    disabled={blocks.length === 0}
                  >
                    Send
                  </button>
                )}
              </>
            )}
          </div>

          {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

          {/* Campaign details */}
          <div className="admin-form rounded-[3px] border border-[var(--gold-line)] bg-[var(--panel-2)] p-4">
            <label>
              Name
              <input
                value={name}
                disabled={readOnly}
                onChange={(e) => setName(e.target.value)}
                placeholder="Internal name, not shown to recipients"
              />
            </label>
            <label>
              Subject line
              <EmojiField value={subject} onChange={setSubject} placeholder="What shows up in the inbox" />
            </label>
            <label>
              Preheader
              <EmojiField
                value={preheader}
                onChange={setPreheader}
                placeholder="Shown beside the subject in most inboxes"
              />
            </label>

            <label>
              Campaign ID
              <input
                value={mapId}
                disabled={readOnly}
                onChange={(e) => setMapId(e.target.value)}
                placeholder="a-table-this-weekend"
              />
            </label>
            <p className="!mb-2 !mt-[-0.4rem] text-xs normal-case tracking-normal text-[var(--ivory-dim)]">
              Same ID as the promotion if this mail is that offer. Put it on Google, Meta and
              Instagram too.
            </p>
            <div className="!mb-3 flex items-center gap-2 rounded-[3px] border border-[var(--gold-line)] bg-[#050505] px-3 py-2">
              <span className="!mb-0 text-[0.68rem] uppercase tracking-[0.14em] text-[var(--gold)]">
                On the tags
              </span>
              <code className="flex-1 truncate text-xs text-[var(--ivory)]">{campaignTag}</code>
              <button
                type="button"
                className="admin-edit"
                onClick={() => navigator.clipboard?.writeText(campaignTag)}
              >
                Copy
              </button>
            </div>

            <p className="!mb-2 text-[0.68rem] uppercase tracking-[0.14em] text-[var(--ivory-dim)]">
              Also ran on
            </p>
            <label className="!mb-1 flex items-center gap-2 !normal-case !tracking-normal text-sm text-[var(--ivory)]">
              <input
                type="checkbox"
                checked={Boolean(channels.google)}
                disabled={readOnly}
                onChange={(e) => setChannels((c) => ({ ...c, google: e.target.checked }))}
              />
              Google
            </label>
            <label className="!mb-1 flex items-center gap-2 !normal-case !tracking-normal text-sm text-[var(--ivory)]">
              <input
                type="checkbox"
                checked={Boolean(channels.meta)}
                disabled={readOnly}
                onChange={(e) => setChannels((c) => ({ ...c, meta: e.target.checked }))}
              />
              Meta
            </label>
            <label className="!mb-3 flex items-center gap-2 !normal-case !tracking-normal text-sm text-[var(--ivory)]">
              <input
                type="checkbox"
                checked={Boolean(channels.instagram)}
                disabled={readOnly}
                onChange={(e) => setChannels((c) => ({ ...c, instagram: e.target.checked }))}
              />
              Instagram
            </label>

            <label className="!mb-0">
              Audience
              <select value={audience} disabled={readOnly} onChange={(e) => setAudience(e.target.value)}>
                {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <p className="!mb-0 !mt-1 text-xs normal-case tracking-normal text-[var(--ivory-dim)]">
              {audienceCount === null ? "—" : `${audienceCount} people will be included.`} Opted
              out stay off.
            </p>
          </div>

          {/* Blocks */}
          <div className="mt-4 space-y-3">
            {blocks.length === 0 && (
              <p className="admin-empty">Nothing here yet — add a block below to get started.</p>
            )}

            {blocks.map((block, index) => (
              <BlockCard
                key={index}
                block={block}
                index={index}
                total={blocks.length}
                readOnly={readOnly}
                onChange={(patch) => updateBlock(index, patch)}
                onRemove={() => removeBlock(index)}
                onMove={(dir) => moveBlock(index, dir)}
              />
            ))}
          </div>

          {!readOnly && (
            <div className="mt-3 flex flex-wrap gap-2 rounded-[3px] border border-dashed border-[var(--gold-line)] p-3">
              {BLOCK_KINDS.map((kind) => (
                <button
                  key={kind.type}
                  type="button"
                  onClick={() => addBlock(kind.make)}
                  className="flex items-center gap-1.5 rounded-[3px] border border-[var(--gold-line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ivory-dim)] transition-colors hover:text-[var(--ivory)]"
                >
                  <Plus size={14} />
                  <kind.icon size={14} />
                  {kind.label}
                </button>
              ))}
            </div>
          )}

          {/* Send test */}
          <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
            <DialogContent className={DARK_DIALOG}>
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-[#e5e2e1]">Send a test</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[0.68rem] uppercase tracking-[0.14em] text-[rgba(229,226,225,0.68)]">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={`w-full rounded-[3px] border px-3 py-2.5 text-sm ${DIALOG_FIELD}`}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" className={DIALOG_GHOST_BTN} onClick={() => setTestDialogOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={DIALOG_BOOK_BTN}
                    onClick={sendTest}
                    disabled={sendingTest || !testEmail}
                  >
                    {sendingTest ? "Sending…" : "Send test"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Send to everyone */}
          <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
            <DialogContent className={DARK_DIALOG}>
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-[#e5e2e1]">
                  Send this campaign?
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-[rgba(229,226,225,0.68)]">
                  This goes out to {audienceCount ?? "every"} subscribed{" "}
                  {audience === "active" ? "address" : AUDIENCE_LABELS[audience].toLowerCase()} right
                  away, and can&rsquo;t be undone. Save any changes first — sending locks the campaign.
                </p>
                <div className="flex justify-end gap-3">
                  <button type="button" className={DIALOG_GHOST_BTN} onClick={() => setSendDialogOpen(false)}>
                    Not yet
                  </button>
                  <button type="button" className={DIALOG_BOOK_BTN} onClick={confirmSend} disabled={sending}>
                    {sending ? "Sending…" : "Send it"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </aside>
  );
}

function BlockCard({
  block,
  index,
  total,
  readOnly,
  onChange,
  onRemove,
  onMove,
}: {
  block: Block;
  index: number;
  total: number;
  readOnly: boolean;
  onChange: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const kind = BLOCK_KINDS.find((k) => k.type === block.type);

  return (
    <div className="admin-form rounded-[3px] border border-[var(--gold-line)] bg-[var(--panel)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.1em] text-[var(--ivory-dim)]">
          {kind && <kind.icon size={13} />}
          {kind?.label ?? block.type}
        </span>

        {!readOnly && (
          <div className="flex items-center gap-1">
            <button type="button" className="admin-edit" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up">
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              className="admin-edit"
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              aria-label="Move down"
            >
              <ChevronDown size={14} />
            </button>
            <button type="button" className="admin-edit" onClick={onRemove} aria-label="Remove block">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {block.type === "logo" && (
        <div className="flex flex-wrap gap-3">
          <select value={block.size ?? "m"} disabled={readOnly} onChange={(e) => onChange({ size: e.target.value })}>
            <option value="s">Small</option>
            <option value="m">Medium</option>
            <option value="l">Large</option>
          </select>
          <select
            value={block.align ?? "center"}
            disabled={readOnly}
            onChange={(e) => onChange({ align: e.target.value })}
          >
            <option value="center">Center</option>
            <option value="left">Left</option>
          </select>
        </div>
      )}

      {block.type === "kicker" && (
        <EmojiField
          value={block.text ?? ""}
          disabled={readOnly}
          onChange={(text) => onChange({ text })}
          placeholder="Sweet1NE"
        />
      )}

      {block.type === "heading" && (
        <div className="space-y-3">
          <EmojiField value={block.text ?? ""} disabled={readOnly} onChange={(text) => onChange({ text })} placeholder="Heading text" />
          <div className="flex flex-wrap gap-3">
            <select value={block.size ?? "medium"} disabled={readOnly} onChange={(e) => onChange({ size: e.target.value })}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
            <AlignSelect value={block.align} disabled={readOnly} onChange={(align) => onChange({ align })} />
          </div>
        </div>
      )}

      {block.type === "paragraph" && (
        <div className="space-y-3">
          <EmojiField
            value={block.text ?? ""}
            disabled={readOnly}
            onChange={(text) => onChange({ text })}
            placeholder="Body text — a blank line starts a new paragraph"
            multiline
          />
          <AlignSelect value={block.align} disabled={readOnly} onChange={(align) => onChange({ align })} />
        </div>
      )}

      {block.type === "image" && (
        <ImageBlockFields block={block} readOnly={readOnly} onChange={onChange} />
      )}

      {block.type === "note" && (
        <EmojiField
          value={block.text ?? ""}
          disabled={readOnly}
          onChange={(text) => onChange({ text })}
          placeholder="Limited seats tonight"
        />
      )}

      {block.type === "ctas" && (
        <CtaStack items={block.items ?? []} readOnly={readOnly} onChange={(items) => onChange({ items })} />
      )}

      {block.type === "slogan" && (
        <EmojiField
          value={block.text ?? ""}
          disabled={readOnly}
          onChange={(text) => onChange({ text })}
          placeholder="Always in the mood for you."
        />
      )}

      {block.type === "button" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <EmojiField value={block.label ?? ""} disabled={readOnly} onChange={(label) => onChange({ label })} placeholder="Button text" />
          <input
            value={block.url ?? ""}
            disabled={readOnly}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://…"
          />
          <div className="sm:col-span-2">
            <AlignSelect value={block.align} disabled={readOnly} onChange={(align) => onChange({ align })} />
          </div>
        </div>
      )}

      {block.type === "divider" && (
        <p className="text-sm text-[var(--ivory-dim)]">A plain hairline — nothing to set.</p>
      )}
    </div>
  );
}

function CtaStack({
  items,
  readOnly,
  onChange,
}: {
  items: CtaItem[];
  readOnly: boolean;
  onChange: (items: CtaItem[]) => void;
}) {
  function update(i: number, patch: Partial<CtaItem>) {
    onChange(items.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  return (
    <div className="admin-cta-stack">
      {items.map((cta, i) => (
        <div key={i} className="admin-cta-row">
          <label>
            Type
            <select
              value={cta.kind}
              disabled={readOnly}
              onChange={(e) => {
                const kind = e.target.value;
                if (kind === "url") update(i, { kind, label: cta.label || "Open", href: "" });
                else update(i, { kind, label: CTA_PRESETS[kind as CampaignCtaKind], href: "" });
              }}
            >
              <option value="book">Book</option>
              <option value="menu">Menu</option>
              <option value="order">Order</option>
              <option value="url">URL</option>
            </select>
          </label>
          <label>
            Label
            <EmojiField value={cta.label} disabled={readOnly} onChange={(label) => update(i, { label })} />
          </label>
          <label>
            URL
            <input
              type="url"
              placeholder="Custom URL"
              value={cta.kind === "url" ? cta.href : ""}
              disabled={readOnly || cta.kind !== "url"}
              onChange={(e) => update(i, { href: e.target.value })}
            />
          </label>
          {!readOnly && (
            <button type="button" className="admin-ghost" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
              Remove
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          className="admin-edit"
          onClick={() => onChange([...items, { kind: "book", label: CTA_PRESETS.book, href: "" }])}
        >
          Add button
        </button>
      )}
    </div>
  );
}

function AlignSelect({
  value,
  disabled,
  onChange,
}: {
  value?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select value={value ?? "left"} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="left">Left</option>
      <option value="center">Center</option>
      <option value="right">Right</option>
    </select>
  );
}

function ImageBlockFields({
  block,
  readOnly,
  onChange,
}: {
  block: Block;
  readOnly: boolean;
  onChange: (patch: Partial<Block>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleMedia, setVisibleMedia] = useState(MEDIA_PAGE_SIZE);
  const { media } = useMediaLibrary();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/uploads/images?folder=misc`, {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Upload failed.");
      }

      const { url } = await res.json();
      onChange({ url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {block.url && (
        <img src={block.url} alt="" className="max-h-48 w-full rounded-[3px] object-cover" />
      )}

      {error && <p className="admin-hold text-xs">{error}</p>}

      {!readOnly && (
        <>
          {/* Quick pick from the media library — same small-grid-plus-More
              pattern as the menu item editor. */}
          <div className="admin-media-grid is-quick">
            {media.slice(0, visibleMedia).map((item) => {
              const thumb = mediaThumb(item);
              const selected = block.url === thumb;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${item.kind === "video" ? "is-film " : ""}${selected ? "is-on" : ""}`.trim()}
                  aria-pressed={selected}
                  onClick={() => onChange({ url: selected ? "" : thumb })}
                >
                  {thumb && <img src={thumb} alt="" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
          {visibleMedia < media.length && (
            <button type="button" className="admin-ghost" onClick={() => setVisibleMedia((v) => v + MEDIA_PAGE_SIZE)}>
              More images
            </button>
          )}

          <label className="!mb-0 !inline-flex cursor-pointer items-center gap-1.5 !normal-case !tracking-normal text-[var(--ivory-dim)] hover:text-[var(--ivory)]">
            <ImageIcon size={14} />
            {uploading ? "Uploading…" : block.url ? "Replace with a new upload" : "Or upload a new image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFile}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </>
      )}

      <input
        value={block.alt ?? ""}
        disabled={readOnly}
        onChange={(e) => onChange({ alt: e.target.value })}
        placeholder="Alt text"
      />

      <label className="!mb-0 flex items-center gap-2 !normal-case !tracking-normal text-sm text-[var(--ivory)]">
        <input
          type="checkbox"
          checked={Boolean(block.full_width)}
          disabled={readOnly}
          onChange={(e) => onChange({ full_width: e.target.checked })}
          className="h-4 w-4 accent-[var(--gold)]"
        />
        Full width (no side padding)
      </label>
    </div>
  );
}
