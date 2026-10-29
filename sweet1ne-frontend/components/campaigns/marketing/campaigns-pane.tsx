"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ImageIcon, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useMediaLibrary, mediaThumb } from "@/lib/use-media-library";
import { EmojiField } from "@/components/ui/emoji-field";
import { BANNER_POSITIONS } from "@/lib/promotion-blocks";
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
  background?: string | null;
  background_animated?: boolean;
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
  preheader: string | null;
  blocks: Block[];
  background?: string | null;
  background_animated?: boolean;
};

// GET /email-templates — tenant-scoped, same shape as a Campaign minus the
// sending-specific fields.
type EmailTemplate = {
  id: string;
  name: string;
  description: string;
  subject: string;
  preheader: string | null;
  blocks: Block[];
  background?: string | null;
  background_animated?: boolean;
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
const PLACEHOLDER_IMAGE = "/images/homepage-gallery/carousel/web/01-table.jpg";

// Preview-only stand-ins for the fields a brand-new draft starts empty —
// so the live preview reads like a real campaign while it's being built
// instead of showing gaps where the heading/copy/picture would go. Never
// touches the saved draft or the real send: the backend renderer still
// correctly omits a block with no real content once this is actually sent.
function previewBlocks(blocks: Block[]): Block[] {
  return blocks.map((block) => {
    if (block.type === "heading" && !block.text) {
      return { ...block, text: "A table this weekend" };
    }
    if (block.type === "paragraph" && !block.text) {
      return { ...block, text: "Lewisham or Chingford. Same kitchen. Book the room you want." };
    }
    if (block.type === "image" && !block.url) {
      return { ...block, url: PLACEHOLDER_IMAGE };
    }
    return block;
  });
}

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
      full_width: true,
      position: "center",
      fit: "fill",
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
      full_width: true,
      position: "center",
      fit: "fill",
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
 * rather than tucked into a side drawer. The preview uses the same backend
 * renderer as the actual send.
 */
type CampaignsView = "campaigns" | "new" | "templates";

export function CampaignsPane() {
  const [subView, setSubView] = useState<CampaignsView>("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  // Which template's own "Create campaign" button is mid-flight — scoped to
  // one card instead of the whole tab, so the rest of the grid stays usable.
  const [usingTemplateId, setUsingTemplateId] = useState<string | null>(null);
  // The template composer — "new" for the blank card, an existing template
  // when "Preview" opens it for editing, null when the grid itself shows.
  // Unlike campaigns there's no draft row for a brand new one until "Save
  // template" — editing an existing one PATCHes it directly instead.
  const [templateDraft, setTemplateDraft] = useState<EmailTemplate | "new" | null>(
    null,
  );

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

  // Not built on the backend yet — this quietly falls back to an empty
  // grid (just the blank card) until GET /email-templates exists, rather
  // than breaking the tab.
  const loadTemplates = useCallback(
    () =>
      apiFetch("/email-templates")
        .then(setTemplates)
        .catch(() => setTemplates([]))
        .finally(() => setTemplatesLoading(false)),
    [],
  );

  useEffect(() => {
    load();
    loadAudienceCounts();
    loadTemplates();
  }, [load, loadAudienceCounts, loadTemplates]);

  // Now purely "whichever campaign is being edited" — the old fallback to
  // campaigns[0] made sense when the composer sat permanently alongside the
  // table; now it's its own tab, so it has nothing to show until the admin
  // explicitly picks "New campaign" or Edits a row.
  const activeId = editingId;

  function select(id: string) {
    setIsNewDraft(false);
    setEditingId(id);
    setSubView("new");
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
      setIsNewDraft(true);
      setEditingId(draft.id);
      setSubView("new");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that.");
    } finally {
      setCreating(false);
    }
  }

  // Shared by the card's "Create campaign" button and the composer's own
  // one — the composer calls this with whatever's currently on screen,
  // saved or not, same as how its "Send a test" works.
  async function createCampaignFrom(content: {
    name: string;
    subject: string;
    preheader: string | null;
    blocks: Block[];
    background?: string | null;
    background_animated?: boolean;
  }) {
    const draft = await apiFetch("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: content.name,
        subject: content.subject,
        preheader: content.preheader,
        blocks: content.blocks,
        background: content.background ?? null,
        background_animated: content.background_animated ?? false,
      }),
    });
    setCampaigns((prev) => [draft, ...prev]);
    setIsNewDraft(true);
    setEditingId(draft.id);
    setTemplateDraft(null);
    setSubView("new");
  }

  async function applyTemplate(template: EmailTemplate) {
    setUsingTemplateId(template.id);
    setError(null);
    try {
      await createCampaignFrom(template);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't start that campaign.",
      );
    } finally {
      setUsingTemplateId(null);
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
      // Otherwise a stale editingId points at a campaign that no longer
      // exists, next time "New campaign" happens to land back on "new".
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

      <div className="admin-cats" role="group" aria-label="Campaigns view">
        <button
          type="button"
          className={subView === "campaigns" ? "is-on" : undefined}
          onClick={() => setSubView("campaigns")}
        >
          Campaigns
        </button>
        <button
          type="button"
          className={subView === "new" ? "is-on" : undefined}
          onClick={createDraft}
          disabled={creating}
        >
          {creating ? "Creating…" : "New campaign"}
        </button>
        <button
          type="button"
          className={subView === "templates" ? "is-on" : undefined}
          onClick={() => setSubView("templates")}
        >
          Email templates
        </button>
      </div>

      {subView === "campaigns" && (
        <>
          {loading ? (
            <AdminLoading />
          ) : campaigns.length === 0 ? (
            <p className="admin-empty">
              No campaigns yet. New campaign uses this look — logo first, then
              the letter.
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
                  &ldquo;{deleting?.subject || "This draft"}&rdquo; will be gone
                  for good.
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
        </>
      )}

      {subView === "new" &&
        (activeId ? (
          <div className="admin-camp-desk">
            <MailStagePreview draft={previewDraft} />
            <CampaignEditor
              key={activeId}
              id={activeId}
              isNew={isNewDraft}
              audienceCounts={audienceCounts}
              onClose={() => {
                setEditingId(null);
                setPreviewDraft(null);
                setSubView("campaigns");
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
        ) : (
          <p className="admin-empty">
            {creating ? "Creating…" : 'Click "New campaign" to start one.'}
          </p>
        ))}

      {subView === "templates" &&
        (templateDraft ? (
          <div className="admin-camp-desk">
            <MailStagePreview draft={previewDraft} />
            <TemplateComposer
              key={templateDraft === "new" ? "new" : templateDraft.id}
              template={templateDraft === "new" ? null : templateDraft}
              onClose={() => {
                setTemplateDraft(null);
                setPreviewDraft(null);
              }}
              onDraftChange={setPreviewDraft}
              onSaved={(template) => {
                setTemplates((prev) =>
                  prev.some((t) => t.id === template.id)
                    ? prev.map((t) => (t.id === template.id ? template : t))
                    : [template, ...prev],
                );
                setTemplateDraft(null);
                setPreviewDraft(null);
              }}
              onCreateCampaign={createCampaignFrom}
            />
          </div>
        ) : templatesLoading ? (
          <AdminLoading />
        ) : (
          <div className="admin-tpl-grid">
            {templates.map((template) => (
              <div key={template.id} className="admin-tpl-card">
                <TemplateThumb template={template} />
                <span className="admin-tpl-name">{template.name}</span>
                <div className="admin-tpl-overlay">
                  <h3>{template.name}</h3>
                  <p>{template.description}</p>
                  <div className="admin-tpl-actions">
                    <button
                      type="button"
                      onClick={() => setTemplateDraft(template)}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTemplate(template)}
                      disabled={usingTemplateId === template.id}
                    >
                      {usingTemplateId === template.id
                        ? "Starting…"
                        : "Create campaign"}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="admin-tpl-card is-blank"
              onClick={() => setTemplateDraft("new")}
            >
              <Plus className="admin-tpl-mark" aria-hidden="true" />
              Create a custom template
            </button>
          </div>
        ))}
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

// A real email is ~600px wide — the thumbnail renders it at that intrinsic
// size, then CSS-scales the whole iframe down to whatever the card
// actually measures, so what's shown is the genuine render, just shrunk,
// not a separate lo-fi mockup.
const THUMB_WIDTH = 600;

function TemplateThumb({ template }: { template: EmailTemplate }) {
  const [html, setHtml] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    let current = true;
    apiFetch("/campaigns/preview", {
      method: "POST",
      body: JSON.stringify({
        name: template.name,
        subject: template.subject,
        preheader: template.preheader,
        blocks: previewBlocks(template.blocks),
        background: template.background ?? null,
        background_animated: template.background_animated ?? false,
      }),
    })
      .then(({ html: rendered }: { html: string }) => {
        if (current) setHtml(rendered);
      })
      .catch(() => {
        // A failed render just leaves the card blank-faced — the name
        // caption and overlay still work fine without it.
      });
    return () => {
      current = false;
    };
  }, [template]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      if (el.offsetWidth) setScale(el.offsetWidth / THUMB_WIDTH);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="admin-tpl-thumb">
      {html && (
        <iframe
          title={`${template.name} preview`}
          srcDoc={html}
          tabIndex={-1}
          aria-hidden="true"
          style={{
            width: THUMB_WIDTH,
            height: THUMB_WIDTH * 1.4,
            transform: `scale(${scale})`,
          }}
        />
      )}
    </div>
  );
}

/** Uses the real email renderer, so the live preview cannot drift from
   the HTML sent to recipients. */
function MailStagePreview({ draft }: { draft: PreviewDraft | null }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [frameHeight, setFrameHeight] = useState(416);

  useEffect(() => {
    if (!draft) return;

    let current = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      apiFetch("/campaigns/preview", {
        method: "POST",
        body: JSON.stringify({
          name: draft.name || draft.subject,
          subject: draft.subject,
          preheader: draft.preheader,
          blocks: previewBlocks(draft.blocks),
          background: draft.background ?? null,
          background_animated: draft.background_animated ?? false,
        }),
      })
        .then(({ html: rendered }: { html: string }) => {
          if (current) setHtml(rendered);
        })
        .catch((err) => {
          if (current) {
            setError(err instanceof Error ? err.message : "Couldn't render that email.");
          }
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 250);

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [draft]);

  if (!draft) {
    return <section className="admin-mail-preview" aria-label="Email preview" />;
  }

  return (
    <section className="admin-mail-preview" aria-label="Email preview">
      {error ? (
        <p className="admin-hold p-6 text-center text-sm">{error}</p>
      ) : loading && !html ? (
        <p className="admin-muted p-6 text-center text-sm">Rendering email…</p>
      ) : (
        <iframe
          title="Live email preview"
          srcDoc={html}
          className="admin-mail-preview-frame"
          style={{ height: frameHeight }}
          onLoad={(e) => {
            const doc = e.currentTarget.contentDocument;
            if (doc) setFrameHeight(Math.max(416, doc.documentElement.scrollHeight));
          }}
        />
      )}
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
  const [preheader, setPreheader] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  // The whole email's own page color — not a block, applies to the entire
  // template at once (body background, surface, and derived text/accent
  // colors). "" means "use the default dark look".
  const [background, setBackground] = useState("");
  // A slow shimmering gradient across shades of that same color instead
  // of a flat fill — meaningless without a background chosen.
  const [backgroundAnimated, setBackgroundAnimated] = useState(false);
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
        setPreheader(c.preheader ?? "");
        setBlocks(c.blocks ?? []);
        setBackground(c.background ?? "");
        setBackgroundAnimated(c.background_animated ?? false);
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
    onDraftChange({
      name,
      subject,
      preheader: preheader || null,
      blocks,
      background: background || null,
      background_animated: backgroundAnimated,
    });
  }, [
    name,
    subject,
    preheader,
    blocks,
    background,
    backgroundAnimated,
    onDraftChange,
  ]);

  function updateBlock(index: number, patch: Partial<Block>) {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    );
  }

  function addBlock(type: string, make: () => Block) {
    // Reuse the empty picture block every new campaign starts with instead
    // of adding a second picture row.
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
        preheader: preheader || null,
        blocks,
        background: background || null,
        background_animated: backgroundAnimated,
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
          preheader: preheader || null,
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
  }, [subject, name, preheader, blocks, audience, channels, mapId]);

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
          {campaign.status === "sent" && (
            <p className="admin-dek">
              Sent to {campaign.sent_count} {campaign.sent_count === 1 ? "person" : "people"}
              {campaign.failed_count > 0 ? ` · ${campaign.failed_count} failed` : ""}.
            </p>
          )}

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
              Inbox preview text
              <input
                value={preheader}
                disabled={readOnly}
                onChange={(e) => setPreheader(e.target.value)}
                placeholder="The short text shown beside the subject"
              />
            </label>

            <div>
              <p className="admin-kicker">Background</p>
              <p className="!mb-2 !mt-[-0.3rem] text-xs normal-case tracking-normal text-[var(--ivory-dim)]">
                Sets the page color for the whole email — Light switches the
                whole template to a light page, not just one block.
              </p>
              <ColorField
                value={background}
                readOnly={readOnly}
                onChange={setBackground}
              />
              <label className="!mb-0 mt-2 flex items-center gap-2 !normal-case !tracking-normal text-sm text-[var(--ivory)]">
                <input
                  type="checkbox"
                  checked={backgroundAnimated}
                  disabled={readOnly || !background}
                  onChange={(e) => setBackgroundAnimated(e.target.checked)}
                  className="h-4 w-4 accent-[var(--gold)]"
                />
                Animate this background (a slow shimmer, not a flat fill)
              </label>
            </div>

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
                    Preview
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

/**
 * Doubles as both "create" and "edit" — a null template means a new,
 * unsaved one (purely client-side state until "Save template", unlike
 * CampaignEditor there's no row to PATCH until it's actually finished);
 * an existing template prefills every field and "Save" PATCHes it in
 * place instead. Shares the same block-editing building blocks as
 * CampaignEditor (BlockCard, BLOCK_KINDS), minus anything campaign-only
 * (audience, channels, sending).
 */
function TemplateComposer({
  template,
  onClose,
  onDraftChange,
  onSaved,
  onCreateCampaign,
}: {
  template?: EmailTemplate | null;
  onClose: () => void;
  onDraftChange: (draft: PreviewDraft) => void;
  onSaved: (template: EmailTemplate) => void;
  onCreateCampaign: (content: {
    name: string;
    subject: string;
    preheader: string | null;
    blocks: Block[];
    background?: string | null;
    background_animated?: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [preheader, setPreheader] = useState(template?.preheader ?? "");
  const [blocks, setBlocks] = useState<Block[]>(
    template?.blocks ?? defaultCampaignBlocks(),
  );
  const [background, setBackground] = useState(template?.background ?? "");
  const [backgroundAnimated, setBackgroundAnimated] = useState(
    template?.background_animated ?? false,
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [startingCampaign, setStartingCampaign] = useState(false);

  useEffect(() => {
    onDraftChange({
      name,
      subject,
      preheader: preheader || null,
      blocks,
      background: background || null,
      background_animated: backgroundAnimated,
    });
  }, [
    name,
    subject,
    preheader,
    blocks,
    background,
    backgroundAnimated,
    onDraftChange,
  ]);

  function updateBlock(index: number, patch: Partial<Block>) {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    );
  }

  function addBlock(type: string, make: () => Block) {
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

  async function save() {
    if (!name.trim() || !subject.trim()) {
      setError("A name and a subject are both needed before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({
        name,
        description,
        subject,
        preheader: preheader || null,
        blocks,
        background: background || null,
        background_animated: backgroundAnimated,
      });
      const saved = template
        ? await apiFetch(`/email-templates/${template.id}`, {
            method: "PATCH",
            body,
          })
        : await apiFetch("/email-templates", { method: "POST", body });
      onSaved(saved);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save that template.",
      );
    } finally {
      setSaving(false);
    }
  }

  // Stateless, same as the live preview beside it — sends exactly what's
  // on screen right now, saved or not.
  async function sendTest() {
    if (!testEmail) return;
    setSendingTest(true);
    setError(null);
    setTestSent(false);
    try {
      await apiFetch("/email-templates/test-send", {
        method: "POST",
        body: JSON.stringify({
          subject,
          preheader: preheader || null,
          blocks,
          background: background || null,
          background_animated: backgroundAnimated,
          email: testEmail,
        }),
      });
      setTestSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that test.");
    } finally {
      setSendingTest(false);
    }
  }

  // Starts a real campaign from whatever's currently on screen — the
  // full audience-aware send lives on that campaign's own editor, not
  // here, since a template has no audience of its own.
  async function createCampaign() {
    setStartingCampaign(true);
    setError(null);
    try {
      await onCreateCampaign({
        name: name || subject,
        subject,
        preheader: preheader || null,
        blocks,
        background: background || null,
        background_animated: backgroundAnimated,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't start that campaign.",
      );
    } finally {
      setStartingCampaign(false);
    }
  }

  return (
    <section className="admin-camp-build">
      <h2 id="camp-title">
        {template ? "Edit template" : "Create a custom template"}
      </h2>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            (e.target as HTMLElement).tagName === "INPUT"
          ) {
            e.preventDefault();
          }
        }}
      >
        <label>
          Template name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekend special"
            required
          />
        </label>
        <label>
          Short description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this template's for — shown on its card"
          />
        </label>
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
          Inbox preview text
          <input
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            placeholder="The short text shown beside the subject"
          />
        </label>

        <div>
          <p className="admin-kicker">Background</p>
          <p className="!mb-2 !mt-[-0.3rem] text-xs normal-case tracking-normal text-[var(--ivory-dim)]">
            Sets the page color for the whole email — Light switches the
            whole template to a light page, not just one block.
          </p>
          <ColorField
            value={background}
            readOnly={false}
            onChange={setBackground}
          />
          <label className="!mb-0 mt-2 flex items-center gap-2 !normal-case !tracking-normal text-sm text-[var(--ivory)]">
            <input
              type="checkbox"
              checked={backgroundAnimated}
              disabled={!background}
              onChange={(e) => setBackgroundAnimated(e.target.checked)}
              className="h-4 w-4 accent-[var(--gold)]"
            />
            Animate this background (a slow shimmer, not a flat fill)
          </label>
        </div>

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
              readOnly={false}
              selected={selectedIndex === index}
              onSelect={() => setSelectedIndex(index)}
              onChange={(patch) => updateBlock(index, patch)}
              onRemove={() => removeBlock(index)}
              onMove={(dir) => moveBlock(index, dir)}
            />
          ))}
        </div>

        <div className="admin-bit-bar" role="group" aria-label="Add a bit">
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

        <div className="mt-2">
          <p className="admin-kicker">Test &amp; send</p>
          <p className="!mb-2 !mt-[-0.3rem] text-xs normal-case tracking-normal text-[var(--ivory-dim)]">
            Send this to one inbox to see how it really looks, or turn it
            into a real campaign — the full send-to-the-list step lives on
            the new campaign&rsquo;s own editor.
          </p>
          <div className="admin-row-acts">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => {
                setTestEmail(e.target.value);
                setTestSent(false);
              }}
              placeholder="you@sweet1ne.com"
              autoComplete="email"
              className="min-w-[14rem] flex-1"
            />
            <button
              type="button"
              className="admin-book"
              onClick={sendTest}
              disabled={sendingTest || !testEmail || !subject.trim()}
            >
              {sendingTest ? "Sending…" : testSent ? "Sent" : "Send a test"}
            </button>
            <button
              type="button"
              className="admin-book"
              onClick={createCampaign}
              disabled={startingCampaign || !subject.trim()}
            >
              {startingCampaign ? "Starting…" : "Create campaign"}
            </button>
          </div>
        </div>

        <p className="admin-row-acts is-sticky">
          <button type="submit" className="admin-book" disabled={saving}>
            {saving ? "Saving…" : "Save template"}
          </button>
          <button type="button" className="admin-book" onClick={onClose}>
            Close
          </button>
        </p>
      </form>
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
          <div className="space-y-3">
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
            <div>
              <p className="admin-kicker">Color</p>
              <ColorField
                value={block.color}
                readOnly={readOnly}
                onChange={(color) => onChange({ color })}
              />
            </div>
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
            <div>
              <p className="admin-kicker">Color</p>
              <ColorField
                value={block.color}
                readOnly={readOnly}
                onChange={(color) => onChange({ color })}
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
            <div>
              <p className="admin-kicker">Color</p>
              <ColorField
                value={block.color}
                readOnly={readOnly}
                onChange={(color) => onChange({ color })}
              />
            </div>
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
          <div className="space-y-3">
            <CtaStack
              items={block.items ?? []}
              readOnly={readOnly}
              onChange={(items) => onChange({ items })}
            />
            <ButtonColorFields
              textColor={block.color}
              background={block.background}
              readOnly={readOnly}
              onChange={onChange}
            />
          </div>
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
            <div className="sm:col-span-2">
              <ButtonColorFields
                textColor={block.color}
                background={block.background}
                readOnly={readOnly}
                onChange={onChange}
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

// A small curated palette plus a native color input for anything else —
// "" always means "use the design's own default", never a literal color,
// so old blocks saved before this field existed keep looking the same.
const COLOR_PRESETS: { key: string; label: string; value: string }[] = [
  { key: "default", label: "Default", value: "" },
  { key: "gold", label: "Gold", value: "#c9a24a" },
  { key: "light", label: "Light", value: "#f3efe8" },
  { key: "red", label: "Red", value: "#8c3b3b" },
  { key: "blue", label: "Blue", value: "#3b5b78" },
];

function ColorField({
  value,
  readOnly,
  onChange,
}: {
  value?: string;
  readOnly: boolean;
  onChange: (color: string) => void;
}) {
  return (
    <div className="admin-color-row" role="group" aria-label="Color">
      {COLOR_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          className={(value || "") === preset.value ? "is-on" : undefined}
          disabled={readOnly}
          title={preset.label}
          onClick={() => onChange(preset.value)}
        >
          <span
            className={preset.value ? undefined : "is-none"}
            style={preset.value ? { background: preset.value } : undefined}
          />
        </button>
      ))}
      <input
        type="color"
        value={value || "#c9a24a"}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className="admin-color-custom"
        title="Custom color"
        aria-label="Custom color"
      />
    </div>
  );
}

// Shared by both the "button" and "ctas" blocks — one text color and one
// background color for every button in that block. Leaving background
// unset keeps the usual outline look (transparent fill, border matching
// the text color); setting one switches to a filled button instead.
function ButtonColorFields({
  textColor,
  background,
  readOnly,
  onChange,
}: {
  textColor?: string;
  background?: string;
  readOnly: boolean;
  onChange: (patch: Partial<Block>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="admin-kicker">Text color</p>
        <ColorField
          value={textColor}
          readOnly={readOnly}
          onChange={(color) => onChange({ color })}
        />
      </div>
      <div>
        <p className="admin-kicker">Background color</p>
        <ColorField
          value={background}
          readOnly={readOnly}
          onChange={(background) => onChange({ background })}
        />
      </div>
    </div>
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
      onChange({ url, fit: "fill", full_width: true });
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
                  onClick={() =>
                    onChange(
                      selected
                        ? { url: "" }
                        : { url: thumb, fit: "fill", full_width: true },
                    )
                  }
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
