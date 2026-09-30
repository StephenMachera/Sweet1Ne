"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ImageIcon, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useMediaLibrary, mediaThumb } from "@/lib/use-media-library";
import { EmojiField } from "@/components/ui/emoji-field";
import {
  BANNER_POSITIONS,
  BANNER_POSITION_COORDS,
  type BannerPosition,
} from "@/lib/promotion-blocks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminLoading } from "@/components/admin/admin-loading";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const MEDIA_PAGE_SIZE = 9;

// The delete/test/send dialogs are portaled by @base-ui to document.body,
// outside .admin-shell — var(--x) tokens don't cascade there, so literal
// hex/rgba values are used instead (same fix as the other admin dialogs).
const DARK_DIALOG =
  "border border-[rgba(201,162,74,0.42)] bg-[#0c0c0c] text-[#e5e2e1] sm:max-w-sm";
const DIALOG_BOOK_BTN =
  "inline-flex items-center justify-center rounded-[3px] border border-[rgba(201,162,74,0.9)] bg-transparent px-[1.15rem] py-[0.6rem] text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[#c9a24a] hover:bg-[#c9a24a] hover:text-[#0e0e0e] disabled:opacity-50";
const DIALOG_GHOST_BTN =
  "px-[1.15rem] py-[0.6rem] text-[0.75rem] uppercase tracking-[0.1em] text-[rgba(229,226,225,0.68)] hover:text-[#e5e2e1]";
const DIALOG_FIELD =
  "border-[rgba(201,162,74,0.35)] bg-[#050505] text-[#e5e2e1]";

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
  qr: "Table QR",
  booking: "Bookings",
  quiet: "Away 50 days",
  regular: "4+ visits",
};

// A draggable size instead of three fixed steps — old campaigns still carry
// the three old preset strings, so this maps those to a starting point on
// the new px scale rather than resetting them to the default.
const HEADING_SIZE_MIN = 16;
const HEADING_SIZE_MAX = 44;
const HEADING_SIZE_PRESETS: Record<string, number> = {
  small: 20,
  medium: 26,
  large: 34,
};

function headingSizePx(size: unknown): number {
  if (typeof size === "number" && Number.isFinite(size)) return size;
  return HEADING_SIZE_PRESETS[size as string] ?? 26;
}

type Block = Record<string, any> & { type: string };
type CtaItem = { kind: string; label: string; href: string };
type PreviewDraft = {
  name: string;
  subject: string;
  blocks: Block[];
};

type CampaignCtaKind = "book" | "menu" | "order";
const CTA_PRESETS: Record<CampaignCtaKind, string> = {
  book: "Book a table",
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

// Same shape as the reference build's own new-campaign default — logo
// first, then the letter — so a fresh draft already reads as a real email
// instead of an empty box. The logo block replaces the fixed chrome header
// (see campaign_renderer.render_campaign's show_header) so the marketer gets
// real size/position control over it rather than a fixed, uneditable one.
// No default photo: unlike the mockup's fixed asset pack, a real tenant has
// no guaranteed stock image to fall back to, so the picture slot starts
// empty for the marketer to fill.
function defaultCampaignBlocks(): Block[] {
  return [
    { type: "logo", size: "l", align: "center" },
    { type: "kicker", text: "Sweet1NE", align: "center" },
    { type: "heading", text: "", size: 26, align: "center" },
    { type: "paragraph", text: "", align: "center" },
    {
      type: "image",
      url: "",
      alt: "",
      full_width: false,
      position: "center",
      fit: "fit",
    },
    {
      type: "ctas",
      items: [{ kind: "book", label: "Book a table", href: "" }],
      align: "center",
    },
    { type: "slogan", text: "Always in the mood for you." },
  ];
}

const BLOCK_KINDS: {
  type: string;
  label: string;
  make: () => Block;
}[] = [
  {
    type: "logo",
    label: "Logo",
    make: () => ({ type: "logo", size: "m", align: "center" }),
  },
  {
    type: "kicker",
    label: "Kicker",
    make: () => ({ type: "kicker", text: "" }),
  },
  {
    type: "heading",
    label: "Title",
    make: () => ({ type: "heading", text: "", size: 26, align: "left" }),
  },
  {
    type: "paragraph",
    label: "Copy",
    make: () => ({ type: "paragraph", text: "", align: "left" }),
  },
  {
    type: "image",
    label: "Picture",
    make: () => ({
      type: "image",
      url: "",
      alt: "",
      full_width: false,
      position: "center",
      fit: "fit",
    }),
  },
  {
    type: "note",
    label: "Note",
    make: () => ({ type: "note", text: "" }),
  },
  {
    type: "ctas",
    label: "Buttons",
    make: () => ({
      type: "ctas",
      items: [{ kind: "book", label: "Book a table", href: "" }],
    }),
  },
  {
    type: "slogan",
    label: "Slogan",
    make: () => ({ type: "slogan", text: "Always in the mood for you." }),
  },
  {
    type: "button",
    label: "Button",
    make: () => ({ type: "button", label: "", url: "", align: "left" }),
  },
  {
    type: "divider",
    label: "Divider",
    make: () => ({ type: "divider" }),
  },
];

/**
 * Campaigns tab of the unified /admin/marketing page. One table (every
 * campaign, regardless of status), and — right below it — the campaign
 * look: a live preview next to the editor, both always on screen together
 * rather than tucked into a side drawer. That editor-side preview is a
 * plain client-side mockup for on-screen editing, not the real send-safe
 * HTML — the Send dialog (in CampaignEditor, below) is what actually calls
 * /campaigns/preview and shows the real rendered letter before anything
 * goes out.
 */
export function CampaignsPane() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // True once the admin has explicitly closed the desk — suppresses the
  // "show the first campaign" fallback below until they pick one again, so
  // Close actually closes instead of silently reopening campaigns[0].
  const [manuallyClosed, setManuallyClosed] = useState(false);
  const [previewDraft, setPreviewDraft] = useState<PreviewDraft | null>(null);
  const [audienceCounts, setAudienceCounts] = useState<Record<
    string,
    number
  > | null>(null);
  // Only true for the campaign just created by "New campaign", and only
  // until it's explicitly saved or the admin selects something else —
  // every campaign gets a real id immediately in this app, so id presence
  // alone can't tell "New" from "Edit" the way the reference build's
  // in-memory draft could.
  const [isNewDraft, setIsNewDraft] = useState(false);

  const load = useCallback(
    () =>
      apiFetch("/campaigns")
        .then(setCampaigns)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    [],
  );

  const loadAudienceCounts = useCallback(
    () =>
      apiFetch("/campaigns/audience-counts")
        .then(setAudienceCounts)
        .catch(() => setAudienceCounts(null)),
    [],
  );

  useEffect(() => {
    load();
    loadAudienceCounts();
  }, [load, loadAudienceCounts]);

  // The first campaign shows by default, same as the reference build — the
  // look is meant to be visible right away, not only after a click. Derived
  // at render time rather than synced via an effect, since it's just a
  // fallback over campaigns that are already in state — unless the admin
  // just closed it, in which case that fallback is suppressed.
  const activeId =
    editingId ?? (manuallyClosed ? null : (campaigns[0]?.id ?? null));

  function select(id: string) {
    setManuallyClosed(false);
    setIsNewDraft(false);
    setEditingId(id);
  }

  async function createDraft() {
    setCreating(true);
    setError(null);
    try {
      const draft = await apiFetch("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: "Untitled campaign",
          subject: "",
          blocks: defaultCampaignBlocks(),
        }),
      });
      setCampaigns((prev) => [draft, ...prev]);
      setManuallyClosed(false);
      setIsNewDraft(true);
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
      const copy = await apiFetch(`/campaigns/${campaign.id}/duplicate`, {
        method: "POST",
      });
      setCampaigns((prev) => [copy, ...prev]);
      select(copy.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't duplicate that.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiFetch(`/campaigns/${deleting.id}`, { method: "DELETE" });
      setCampaigns((prev) => prev.filter((c) => c.id !== deleting.id));
      // Otherwise the desk keeps trying to load a campaign that no longer
      // exists and shows nothing but an error.
      if (deleting.id === activeId) {
        setEditingId(null);
        setPreviewDraft(null);
      }
      setDeleting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that.");
      setDeleting(null);
    }
  }

  return (
    <>
      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <div className="admin-tools">
        <button
          type="button"
          className="admin-book"
          onClick={createDraft}
          disabled={creating}
        >
          {creating ? "Creating…" : "New campaign"}
        </button>
      </div>

      {loading ? (
        <AdminLoading />
      ) : campaigns.length === 0 ? (
        <p className="admin-empty">
          No campaigns yet. New campaign uses this look — logo first, then the
          letter.
        </p>
      ) : (
        <div className="admin-data-panel">
          <table className="admin-sheet">
            <thead>
              <tr>
                <th>Subject</th>
                <th>ID</th>
                <th>Audience</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  audienceCount={audienceCounts?.[campaign.audience] ?? null}
                  onEdit={() => select(campaign.id)}
                  onDuplicate={() => duplicate(campaign)}
                  onDelete={
                    campaign.status === "draft"
                      ? () => setDeleting(campaign)
                      : undefined
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent className={DARK_DIALOG}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#e5e2e1]">
              Delete this draft?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-[rgba(229,226,225,0.68)]">
              &ldquo;{deleting?.subject || "This draft"}&rdquo; will be gone for
              good.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className={DIALOG_GHOST_BTN}
                onClick={() => setDeleting(null)}
              >
                Keep it
              </button>
              <button
                type="button"
                className={DIALOG_BOOK_BTN}
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* The look — always visible alongside the table, matching the
          reference build's own two-column camp-desk, rather than tucked
          away in a side drawer. */}
      {activeId && (
        <div className="admin-camp-desk">
          <MailStagePreview draft={previewDraft} />
          <CampaignEditor
            key={activeId}
            id={activeId}
            isNew={isNewDraft}
            audienceCounts={audienceCounts}
            onClose={() => {
              setEditingId(null);
              setManuallyClosed(true);
              setPreviewDraft(null);
            }}
            onDraftChange={setPreviewDraft}
            onSaved={(updated) => {
              setCampaigns((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c)),
              );
              setIsNewDraft(false);
              loadAudienceCounts();
            }}
          />
        </div>
      )}
    </>
  );
}

function CampaignRow({
  campaign,
  audienceCount,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  campaign: Campaign;
  audienceCount: number | null;
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
    <tr onClick={onEdit} style={{ cursor: "pointer" }}>
      <td>
        <span className="admin-name">
          {campaign.subject || "No subject yet"}
        </span>
      </td>
      <td className="admin-muted">{campaign.map_id || ""}</td>
      <td className="admin-muted">
        {audienceCount ?? "—"} ·{" "}
        {AUDIENCE_LABELS[campaign.audience] ?? campaign.audience}
      </td>
      <td>
        <span className={statusCls[campaign.status]}>
          {STATUS_LABELS[campaign.status] ?? campaign.status}
        </span>
      </td>
      <td className="admin-row-acts">
        <button
          type="button"
          className="admin-edit"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          <Copy size={14} />
        </button>
        {onDelete && (
          <button
            type="button"
            className="admin-edit"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
        <button
          type="button"
          className="admin-edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          {campaign.status === "draft" ? "Edit" : "View"}
        </button>
      </td>
    </tr>
  );
}

const LOGO_SRC = "/images/brand/logo.png";

/** What the marketer actually sees on screen — a direct DOM mockup, not the
   email-safe inline-style HTML /campaigns/preview builds for a real inbox
   (that endpoint's HTML still backs "Send test" and the real send; this
   component never touches it). Renders straight from the live block state,
   so it updates instantly with no debounce or network round trip. */
function MailStagePreview({ draft }: { draft: PreviewDraft | null }) {
  const { media } = useMediaLibrary();
  if (!draft) return <div className="admin-mail-preview" />;

  // The tenant's own most recent upload — a real photo they actually own,
  // never the logo — shown only when the marketer hasn't picked one yet.
  const defaultImage = media[0] ? mediaThumb(media[0]) : "";
  const hasLogoBlock = draft.blocks.some((b) => b.type === "logo");
  const isLeft = draft.blocks.some(
    (b) => b.type === "logo" && b.align === "left",
  );

  return (
    <section className={`admin-mail-preview${isLeft ? " is-left" : ""}`}>
      {/* No logo block yet — the real send falls back to the same
          fixed header logo (see campaign_renderer.render_campaign's
          show_header), so the preview must match that, not go bare. */}
      {!hasLogoBlock && (
        <div>
          <img className="admin-mark" src={LOGO_SRC} alt="Sweet1NE" />
          <hr />
        </div>
      )}
      {draft.blocks.map((block, i) => {
        switch (block.type) {
          case "logo": {
            const sizeClass =
              block.size === "s" ? " is-s" : block.size === "l" ? " is-l" : "";
            return (
              <div key={i}>
                <img
                  className={`admin-mark${sizeClass}`}
                  src={LOGO_SRC}
                  alt="Sweet1NE"
                />
                <hr />
              </div>
            );
          }
          case "kicker":
            return (
              <p key={i} className="admin-kicker">
                {block.text || "Sweet1NE"}
              </p>
            );
          case "heading": {
            return (
              <h2
                key={i}
                style={{
                  fontSize: `${headingSizePx(block.size)}px`,
                  textAlign: (block.align ?? "left") as React.CSSProperties["textAlign"],
                }}
              >
                {block.text || "Subject and title sit here."}
              </h2>
            );
          }
          case "paragraph":
            return (
              <p
                key={i}
                className="admin-dek"
                style={{
                  textAlign: (block.align ?? "left") as React.CSSProperties["textAlign"],
                }}
              >
                {block.text || "Write the mail. The look stays the website."}
              </p>
            );
          case "note":
            return block.text ? (
              <p key={i} className="admin-dek">
                {block.text}
              </p>
            ) : null;
          case "image": {
            const url = block.url || defaultImage;
            if (!url) return null;
            const objectFit = block.fit === "fit" ? "contain" : "cover";
            const objectPosition =
              BANNER_POSITION_COORDS[block.position as BannerPosition] ??
              BANNER_POSITION_COORDS.center;
            return (
              <img
                key={i}
                className="admin-still"
                src={url}
                alt=""
                style={{ objectFit, objectPosition }}
              />
            );
          }
          case "ctas":
            return (
              <div key={i} className="admin-mail-ctas">
                {(block.items ?? []).map((item: CtaItem, j: number) => (
                  <a
                    key={j}
                    className="admin-book"
                    href="#"
                    onClick={(e) => e.preventDefault()}
                  >
                    {item.label ||
                      CTA_PRESETS[item.kind as CampaignCtaKind] ||
                      "Open"}
                  </a>
                ))}
              </div>
            );
          case "slogan":
            return (
              <p key={i} className="admin-slogan">
                {block.text || "Always in the mood for you."}
              </p>
            );
          default:
            return null;
        }
      })}
      <p className="admin-foot">
        You asked to hear from Sweet1NE. Unsubscribe any time.{" "}
        <a href="/privacy">Privacy</a> · info@sweet1ne.com
      </p>
    </section>
  );
}

function CampaignEditor({
  id,
  isNew,
  audienceCounts,
  onClose,
  onDraftChange,
  onSaved,
}: {
  id: string;
  isNew: boolean;
  audienceCounts: Record<string, number> | null;
  onClose: () => void;
  onDraftChange: (draft: PreviewDraft) => void;
  onSaved: (campaign: Campaign) => void;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  // Which layout row reads gold — purely a "you're looking at this one"
  // marker, same as the reference build's own selection concept. Every
  // block's fields stay visible regardless of which is selected.
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [audience, setAudience] = useState("active");
  const [channels, setChannels] = useState<Channels>({});
  const [mapId, setMapId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testEmail, setTestEmail] = useState("");
  // One panel does both jobs — reviewing the real letter and sending it —
  // matching the reference build's single send-layer rather than two
  // separate dialogs a marketer has to piece together in their head.
  const [sendPanelOpen, setSendPanelOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const readOnly = campaign
    ? ["sent", "sending"].includes(campaign.status)
    : false;

  useEffect(() => {
    apiFetch(`/campaigns/${id}`)
      .then((c: Campaign) => {
        setCampaign(c);
        setName(c.name);
        setSubject(c.subject);
        setBlocks(c.blocks ?? []);
        setAudience(c.audience ?? "active");
        setChannels(c.channels ?? {});
        setMapId(c.map_id ?? "");
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Couldn't load that campaign.",
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);

  // Mirrors the live edit buffer up to the parent on every change, so the
  // preview beside it renders exactly what's on screen right now.
  useEffect(() => {
    onDraftChange({ name, subject, blocks });
  }, [name, subject, blocks, onDraftChange]);

  function updateBlock(index: number, patch: Partial<Block>) {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    );
  }

  function addBlock(type: string, make: () => Block) {
    // "+ Picture" while an empty picture slot already exists (the default
    // one every new campaign starts with, showing a stand-in photo) should
    // point at that same slot, not pile up a second, separate one — a
    // marketer clicking it to replace what they see shouldn't end up with
    // two Picture rows in the Look stack.
    if (type === "image") {
      const existingEmpty = blocks.findIndex(
        (b) => b.type === "image" && !b.url,
      );
      if (existingEmpty !== -1) {
        setSelectedIndex(existingEmpty);
        return;
      }
    }
    setSelectedIndex(blocks.length);
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

  // The PATCH itself, shared by "Save draft" and by test/real sends — both
  // of those read blocks back off the campaign row in the database, so
  // whatever's on screen has to land there first or they'd go out with
  // whatever was last saved (often just the seeded logo), not what the
  // marketer is actually looking at.
  async function persist(): Promise<Campaign> {
    const updated = await apiFetch(`/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        // There's no separate "internal name" field in this UI anymore —
        // kept in step with the subject rather than left frozen at
        // whatever it was called on creation.
        name: subject || name,
        subject,
        blocks,
        audience,
        channels,
        map_id: mapId || null,
      }),
    });
    setCampaign(updated);
    onSaved(updated);
    return updated;
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await persist();
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
      await persist();
      await apiFetch(`/campaigns/${id}/test`, {
        method: "POST",
        body: JSON.stringify({ email: testEmail }),
      });
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
      await persist();
      const updated = await apiFetch(`/campaigns/${id}/send`, {
        method: "POST",
      });
      setCampaign(updated);
      onSaved(updated);
      setSendPanelOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.");
    } finally {
      setSending(false);
    }
  }

  // The real send-safe HTML — same renderer the actual send and test send
  // use — so what's shown here is what goes out, not the editor's own
  // on-screen mockup.
  const loadPreviewHtml = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const { html } = await apiFetch("/campaigns/preview", {
        method: "POST",
        body: JSON.stringify({
          name: subject || name,
          subject,
          blocks,
          audience,
          channels,
          map_id: mapId || null,
        }),
      });
      setPreviewHtml(html);
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Couldn't render that letter.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [subject, name, blocks, audience, channels, mapId]);

  function copyLetterHtml() {
    if (previewHtml) navigator.clipboard?.writeText(previewHtml);
  }

  function openLetter() {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const audienceCount = audienceCounts ? (audienceCounts[audience] ?? 0) : null;

  const campaignTag = `utm_campaign=${slugify(mapId || subject || name) || "your-id"}`;

  return (
    <section className="admin-camp-build">
      {loading || !campaign ? (
        <AdminLoading />
      ) : (
        <>
          <h2 id="camp-title">{isNew ? "New campaign" : "Edit campaign"}</h2>
          <p className="admin-dek">
            Tap a box — gold is the one you are on. Logo is first: size and
            alignment. Pictures take a banner position and fit or fill. Buttons
            can be reordered. Send posts this whole letter, not the subject
            alone.
            {campaign.status === "sent" &&
              ` Sent to ${campaign.sent_count} ${campaign.sent_count === 1 ? "person" : "people"}${campaign.failed_count > 0 ? ` · ${campaign.failed_count} failed` : ""}.`}
          </p>

          {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            onKeyDown={(e) => {
              // Enter used to do nothing here (this wasn't a real <form>
              // before) — a real one submits on Enter from any single-line
              // <input> by default, which would save the draft just from
              // typing a CTA label or the campaign ID and hitting return.
              // Only <input> is guarded — buttons still activate on Enter.
              if (
                e.key === "Enter" &&
                (e.target as HTMLElement).tagName === "INPUT"
              ) {
                e.preventDefault();
              }
            }}
          >
            <label>
              Subject
              <EmojiField
                value={subject}
                onChange={setSubject}
                placeholder="What shows up in the inbox"
                required
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
              Same ID as the promotion if this mail is that offer.
            </p>
            <div className="admin-tag-box">
              <p className="admin-kicker">On the tags</p>
              <code>{campaignTag}</code>
              <button
                type="button"
                className="admin-edit"
                onClick={() => navigator.clipboard?.writeText(campaignTag)}
              >
                Copy
              </button>
            </div>

            <p className="admin-kicker">Audience</p>
            <div
              className="admin-chip-row"
              role="radiogroup"
              aria-label="Audience"
            >
              {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                <label key={value} className="admin-chip">
                  <input
                    type="radio"
                    name="audience"
                    checked={audience === value}
                    disabled={readOnly}
                    onChange={() => setAudience(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <p className="admin-dek">
              {audienceCount === null ? "—" : audienceCount} people on the
              first-party list. Opted out stay off.
            </p>

            {/* Blocks */}
            <div className="mt-4 space-y-3">
              {blocks.length === 0 && (
                <p className="admin-empty">
                  Nothing here yet — add a block below to get started.
                </p>
              )}

              {blocks.map((block, index) => (
                <BlockCard
                  key={index}
                  block={block}
                  index={index}
                  total={blocks.length}
                  readOnly={readOnly}
                  selected={selectedIndex === index}
                  onSelect={() => setSelectedIndex(index)}
                  onChange={(patch) => updateBlock(index, patch)}
                  onRemove={() => removeBlock(index)}
                  onMove={(dir) => moveBlock(index, dir)}
                />
              ))}
            </div>

            {!readOnly && (
              <div
                className="admin-bit-bar"
                role="group"
                aria-label="Add a bit"
              >
                {BLOCK_KINDS.slice(0, 8).map((kind) => (
                  <button
                    key={kind.type}
                    type="button"
                    className="admin-add-bit"
                    onClick={() => addBlock(kind.type, kind.make)}
                  >
                    + {kind.label}
                  </button>
                ))}
              </div>
            )}

            <p className="admin-row-acts is-sticky">
              {!readOnly && (
                <>
                  <button
                    type="submit"
                    className="admin-book"
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save draft"}
                  </button>
                  {campaign.status !== "sent" && (
                    <button
                      type="button"
                      className="admin-book"
                      onClick={() => {
                        setSendPanelOpen(true);
                        loadPreviewHtml();
                      }}
                      disabled={blocks.length === 0}
                    >
                      Send
                    </button>
                  )}
                </>
              )}
              <button type="button" className="admin-book" onClick={onClose}>
                Close
              </button>
            </p>
          </form>

          {/* Send this letter — one panel for reviewing the real HTML and
              sending it, matching the reference build's single send-layer
              rather than a separate "send a test" dialog with no way to see
              what it's actually testing. */}
          <Dialog open={sendPanelOpen} onOpenChange={setSendPanelOpen}>
            <DialogContent className={`${DARK_DIALOG} sm:max-w-xl`}>
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-[#e5e2e1]">
                  Send this letter
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-[rgba(229,226,225,0.68)]">
                  This goes out to {audienceCount ?? "every"} subscribed{" "}
                  {audience === "active"
                    ? "address"
                    : AUDIENCE_LABELS[audience].toLowerCase()}{" "}
                  right away, and can&rsquo;t be undone. Save any changes first
                  — sending locks the campaign.
                </p>
                <p className="text-sm text-[rgba(229,226,225,0.68)]">
                  {audienceCount === null ? "—" : audienceCount}{" "}
                  {audienceCount === 1 ? "address" : "addresses"} —{" "}
                  {AUDIENCE_LABELS[audience]}.
                </p>

                <div className="overflow-hidden rounded-[3px] border border-[rgba(201,162,74,0.35)] bg-[#050505]">
                  {previewLoading ? (
                    <p className="p-8 text-center text-sm text-[rgba(229,226,225,0.5)]">
                      Rendering…
                    </p>
                  ) : previewError ? (
                    <p className="p-8 text-center text-sm text-[#e5a2a2]">
                      {previewError}
                    </p>
                  ) : (
                    <iframe
                      title="Letter"
                      srcDoc={previewHtml ?? ""}
                      className="h-[420px] w-full bg-white"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[0.68rem] uppercase tracking-[0.14em] text-[rgba(229,226,225,0.68)]">
                    Test address
                  </label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="you@sweet1ne.com"
                    autoComplete="email"
                    className={`w-full rounded-[3px] border px-3 py-2.5 text-sm ${DIALOG_FIELD}`}
                  />
                  <p className="text-xs text-[rgba(229,226,225,0.5)]">
                    Sends this HTML letter to one inbox. Does not mark the
                    campaign sent. Opted-out addresses stay off the live send.
                  </p>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    className={DIALOG_GHOST_BTN}
                    onClick={() => setSendPanelOpen(false)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={DIALOG_GHOST_BTN}
                    onClick={openLetter}
                    disabled={!previewHtml}
                  >
                    Open letter
                  </button>
                  <button
                    type="button"
                    className={DIALOG_GHOST_BTN}
                    onClick={copyLetterHtml}
                    disabled={!previewHtml}
                  >
                    Copy HTML
                  </button>
                  <button
                    type="button"
                    className={DIALOG_BOOK_BTN}
                    onClick={sendTest}
                    disabled={sendingTest || !testEmail}
                  >
                    {sendingTest ? "Sending…" : "Send test"}
                  </button>
                  <button
                    type="button"
                    className={DIALOG_BOOK_BTN}
                    onClick={confirmSend}
                    disabled={sending || blocks.length === 0}
                  >
                    {sending ? "Sending…" : "Send to the list"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}

function BlockCard({
  block,
  index,
  total,
  readOnly,
  selected,
  onSelect,
  onChange,
  onRemove,
  onMove,
}: {
  block: Block;
  index: number;
  total: number;
  readOnly: boolean;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const kind = BLOCK_KINDS.find((k) => k.type === block.type);

  return (
    <div
      className={`admin-layout-row is-mail${selected ? " is-on" : ""}`}
      style={{ cursor: "pointer" }}
      onClick={onSelect}
    >
      <div className="admin-block-head">
        <p>{kind?.label ?? block.type}</p>

        {!readOnly && (
          <span className="admin-row-acts">
            <button
              type="button"
              className="admin-add-bit"
              onClick={(e) => {
                e.stopPropagation();
                onMove(-1);
              }}
              disabled={index === 0}
            >
              Up
            </button>
            <button
              type="button"
              className="admin-add-bit"
              onClick={(e) => {
                e.stopPropagation();
                onMove(1);
              }}
              disabled={index === total - 1}
            >
              Down
            </button>
            <button
              type="button"
              className="admin-add-bit"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              Remove
            </button>
          </span>
        )}
      </div>

      {/* The whole row selects on click (see the wrapper's onClick, and
          .admin-layout-row.is-on above) — everything actually editable in
          here stops that bubbling, so picking a banner position or ticking
          a checkbox doesn't fight with that for the click. */}
      <div onClick={(e) => e.stopPropagation()}>
        {block.type === "logo" && (
          <div className="flex flex-wrap gap-3">
            <select
              value={block.size ?? "m"}
              disabled={readOnly}
              onChange={(e) => onChange({ size: e.target.value })}
            >
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
            <EmojiField
              value={block.text ?? ""}
              disabled={readOnly}
              onChange={(text) => onChange({ text })}
              placeholder="Heading text"
            />
            <label className="!mb-0">
              Size — {headingSizePx(block.size)}px
              <input
                type="range"
                min={HEADING_SIZE_MIN}
                max={HEADING_SIZE_MAX}
                step={1}
                value={headingSizePx(block.size)}
                disabled={readOnly}
                onChange={(e) => onChange({ size: Number(e.target.value) })}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <AlignSelect
                value={block.align}
                disabled={readOnly}
                onChange={(align) => onChange({ align })}
              />
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
            <AlignSelect
              value={block.align}
              disabled={readOnly}
              onChange={(align) => onChange({ align })}
            />
          </div>
        )}

        {block.type === "image" && (
          <ImageBlockFields
            block={block}
            readOnly={readOnly}
            onChange={onChange}
          />
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
          <CtaStack
            items={block.items ?? []}
            readOnly={readOnly}
            onChange={(items) => onChange({ items })}
          />
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
            <EmojiField
              value={block.label ?? ""}
              disabled={readOnly}
              onChange={(label) => onChange({ label })}
              placeholder="Button text"
            />
            <input
              value={block.url ?? ""}
              disabled={readOnly}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder="https://…"
            />
            <div className="sm:col-span-2">
              <AlignSelect
                value={block.align}
                disabled={readOnly}
                onChange={(align) => onChange({ align })}
              />
            </div>
          </div>
        )}

        {block.type === "divider" && (
          <p className="text-sm text-[var(--ivory-dim)]">
            A plain hairline — nothing to set.
          </p>
        )}
      </div>
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

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
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
                if (kind === "url")
                  update(i, { kind, label: cta.label || "Open", href: "" });
                else
                  update(i, {
                    kind,
                    label: CTA_PRESETS[kind as CampaignCtaKind],
                    href: "",
                  });
              }}
            >
              <option value="book">Book a table</option>
              <option value="menu">Menu</option>
              <option value="order">Order</option>
              <option value="url">URL</option>
            </select>
          </label>
          <label>
            Label
            <EmojiField
              value={cta.label}
              disabled={readOnly}
              onChange={(label) => update(i, { label })}
            />
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
            <>
              <button
                type="button"
                className="admin-ghost"
                onClick={() => move(i, -1)}
                disabled={i === 0}
              >
                Up
              </button>
              <button
                type="button"
                className="admin-ghost"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
              >
                Down
              </button>
              <button
                type="button"
                className="admin-ghost"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              >
                Remove
              </button>
            </>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          className="admin-add-bit"
          onClick={() =>
            onChange([
              ...items,
              { kind: "book", label: CTA_PRESETS.book, href: "" },
            ])
          }
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
    <select
      value={value ?? "left"}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
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
        headers: session
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Upload failed.");
      }

      const { url } = await res.json();
      onChange({ url });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't upload that image.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {block.url && (
        <img
          src={block.url}
          alt=""
          className="max-h-48 w-full rounded-[3px] object-cover"
        />
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
            <button
              type="button"
              className="admin-ghost"
              onClick={() => setVisibleMedia((v) => v + MEDIA_PAGE_SIZE)}
            >
              More images
            </button>
          )}

          <label className="!mb-0 !inline-flex cursor-pointer items-center gap-1.5 !normal-case !tracking-normal text-[var(--ivory-dim)] hover:text-[var(--ivory)]">
            <ImageIcon size={14} />
            {uploading
              ? "Uploading…"
              : block.url
                ? "Replace with a new upload"
                : "Or upload a new image"}
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

      <label>
        Fit
        <select
          value={block.fit ?? "fit"}
          disabled={readOnly}
          onChange={(e) => onChange({ fit: e.target.value })}
        >
          <option value="fit">Show all of it</option>
          <option value="fill">Fill the frame</option>
        </select>
      </label>
      <div
        className="admin-anchor-grid"
        role="group"
        aria-label="Banner position"
      >
        {BANNER_POSITIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-label={label}
            disabled={readOnly}
            className={
              (block.position ?? "center") === key ? "is-on" : undefined
            }
            onClick={() => onChange({ position: key })}
          >
            <span />
          </button>
        ))}
      </div>
    </div>
  );
}
