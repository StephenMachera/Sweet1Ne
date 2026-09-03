"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  Heading as HeadingIcon,
  ImageIcon,
  Link2,
  Minus,
  Plus,
  Send,
  Trash2,
  Type,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useMe, hasPermission } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type Block = Record<string, any> & { type: string };

type Campaign = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  blocks: Block[];
  status: string;
  sent_at: string | null;
  sent_count: number;
  failed_count: number;
};

const BLOCK_KINDS: { type: string; label: string; icon: typeof Type; make: () => Block }[] = [
  { type: "heading", label: "Heading", icon: HeadingIcon, make: () => ({ type: "heading", text: "", size: "medium", align: "left" }) },
  { type: "paragraph", label: "Text", icon: Type, make: () => ({ type: "paragraph", text: "", align: "left" }) },
  { type: "image", label: "Image", icon: ImageIcon, make: () => ({ type: "image", url: "", alt: "", full_width: false }) },
  { type: "button", label: "Button", icon: Link2, make: () => ({ type: "button", label: "", url: "", align: "left" }) },
  { type: "divider", label: "Divider", icon: Minus, make: () => ({ type: "divider" }) },
];

export default function CampaignEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const canManage = hasPermission(me, "manage_marketing");
  const isUnscoped = me?.branch_id === null;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testEmail, setTestEmail] = useState("");
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const readOnly = campaign ? ["sent", "sending"].includes(campaign.status) : false;

  const load = useCallback(() => {
    return apiFetch(`/campaigns/${id}`)
      .then((c: Campaign) => {
        setCampaign(c);
        setName(c.name);
        setSubject(c.subject);
        setPreheader(c.preheader ?? "");
        setBlocks(c.blocks ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load that campaign."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage || !isUnscoped) {
      router.replace("/admin/dashboard");
      return;
    }
    load();
  }, [meLoading, me, canManage, isUnscoped, router, load]);

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
        body: JSON.stringify({ name, subject, preheader: preheader || null, blocks }),
      });
      setCampaign(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  async function openPreview() {
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const { html } = await apiFetch("/campaigns/preview", {
        method: "POST",
        body: JSON.stringify({ name, subject, preheader: preheader || null, blocks }),
      });
      setPreviewHtml(html);
    } catch (err) {
      setPreviewHtml("<p style='color:#fff;font-family:sans-serif;padding:24px;'>Couldn't render a preview.</p>");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function sendTest() {
    if (!testEmail) return;
    setSendingTest(true);
    setError(null);
    try {
      await apiFetch(`/campaigns/${id}/test`, {
        method: "POST",
        body: JSON.stringify({ email: testEmail }),
      });
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
      setSendDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.");
    } finally {
      setSending(false);
    }
  }

  if (meLoading || !me || !canManage || !isUnscoped || loading || !campaign) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin/marketing/campaigns"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <ArrowLeft size={14} />
            Campaigns
          </Link>
          <h1 className="truncate font-display text-2xl text-ink sm:text-3xl">{name || "Untitled campaign"}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {campaign.status === "sent"
              ? `Sent to ${campaign.sent_count} ${campaign.sent_count === 1 ? "person" : "people"}${campaign.failed_count > 0 ? ` · ${campaign.failed_count} failed` : ""}`
              : readOnly
                ? "Sending…"
                : "Draft"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={openPreview}>
            <Eye size={15} className="mr-1.5" />
            Preview
          </Button>
          {!readOnly && (
            <>
              <Button variant="outline" onClick={() => setTestDialogOpen(true)}>
                Send test
              </Button>
              <Button onClick={save} disabled={saving} className="bg-teal text-white hover:bg-teal/90">
                {saving ? "Saving…" : "Save"}
              </Button>
              {campaign.status !== "sent" && (
                <Button
                  onClick={() => setSendDialogOpen(true)}
                  disabled={blocks.length === 0}
                  className="bg-gold text-ink hover:bg-gold/90"
                >
                  <Send size={15} className="mr-1.5" />
                  Send
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-ember/25 bg-ember-soft px-4 py-3 text-sm text-ember">
          {error}
        </div>
      )}

      {/* Campaign details */}
      <div className="space-y-4 rounded-xl border border-ink/8 bg-white p-4 sm:p-5">
        <div className="space-y-1.5">
          <Label htmlFor="c-name">Name</Label>
          <Input id="c-name" value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} placeholder="Internal name, not shown to recipients" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-subject">Subject line</Label>
          <Input id="c-subject" value={subject} disabled={readOnly} onChange={(e) => setSubject(e.target.value)} placeholder="What shows up in the inbox" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-preheader">Preheader</Label>
          <Input id="c-preheader" value={preheader} disabled={readOnly} onChange={(e) => setPreheader(e.target.value)} placeholder="Shown beside the subject in most inboxes" />
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-3">
        {blocks.length === 0 && (
          <div className="rounded-xl border border-dashed border-ink/15 px-6 py-14 text-center">
            <p className="text-sm text-ink-muted">Nothing here yet — add a block below to get started.</p>
          </div>
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
        <div className="flex flex-wrap gap-2 rounded-xl border border-dashed border-ink/15 p-3">
          {BLOCK_KINDS.map((kind) => (
            <button
              key={kind.type}
              onClick={() => addBlock(kind.make)}
              className="flex items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm text-ink-muted transition-colors hover:border-ink/20 hover:text-ink"
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-ink">Send a test</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="test-email">Email address</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setTestDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={sendTest}
                disabled={sendingTest || !testEmail}
                className="bg-teal text-white hover:bg-teal/90"
              >
                {sendingTest ? "Sending…" : "Send test"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send to everyone */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-ink">Send this campaign?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              This goes out to every subscribed address right away, and can't be undone. Save any
              changes first — sending locks the campaign.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setSendDialogOpen(false)}>
                Not yet
              </Button>
              <Button
                onClick={confirmSend}
                disabled={sending}
                className="bg-gold text-ink hover:bg-gold/90"
              >
                {sending ? "Sending…" : "Send it"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="p-4">
            <DialogTitle className="text-lg font-semibold text-ink">Preview</DialogTitle>
          </DialogHeader>
          <div className="h-[70vh] w-full bg-[#0e0e0e]">
            {previewLoading ? (
              <p className="p-6 text-sm text-white/60">Rendering…</p>
            ) : (
              <iframe title="Campaign preview" srcDoc={previewHtml} className="h-full w-full border-0" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
    <div className="rounded-xl border border-ink/8 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.1em] text-ink-muted">
          {kind && <kind.icon size={13} />}
          {kind?.label ?? block.type}
        </span>

        {!readOnly && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onMove(-1)}
              disabled={index === 0}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30"
              aria-label="Move up"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30"
              aria-label="Move down"
            >
              <ChevronDown size={14} />
            </button>
            <button
              onClick={onRemove}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-ember-soft hover:text-ember"
              aria-label="Remove block"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {block.type === "heading" && (
        <div className="space-y-3">
          <Textarea
            value={block.text ?? ""}
            disabled={readOnly}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Heading text"
          />
          <div className="flex flex-wrap gap-3">
            <select
              value={block.size ?? "medium"}
              disabled={readOnly}
              onChange={(e) => onChange({ size: e.target.value })}
              className="h-9 rounded-lg border border-ink/15 bg-white px-2.5 text-sm"
            >
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
          <Textarea
            value={block.text ?? ""}
            disabled={readOnly}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Body text — a blank line starts a new paragraph"
            rows={4}
          />
          <AlignSelect value={block.align} disabled={readOnly} onChange={(align) => onChange({ align })} />
        </div>
      )}

      {block.type === "image" && (
        <ImageBlockFields block={block} readOnly={readOnly} onChange={onChange} />
      )}

      {block.type === "button" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={block.label ?? ""}
            disabled={readOnly}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Button text"
          />
          <Input
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
        <p className="text-sm text-ink-muted">A plain hairline — nothing to set.</p>
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
      className="h-9 rounded-lg border border-ink/15 bg-white px-2.5 text-sm"
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
        <img src={block.url} alt="" className="max-h-48 w-full rounded-lg object-cover" />
      )}

      {error && <p className="text-xs text-ember">{error}</p>}

      {!readOnly && (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink-muted hover:border-ink/25 hover:text-ink">
          <ImageIcon size={14} />
          {uploading ? "Uploading…" : block.url ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFile}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}

      <Input
        value={block.alt ?? ""}
        disabled={readOnly}
        onChange={(e) => onChange({ alt: e.target.value })}
        placeholder="Alt text"
      />

      <label className="flex items-center gap-2 text-sm text-ink-muted">
        <input
          type="checkbox"
          checked={Boolean(block.full_width)}
          disabled={readOnly}
          onChange={(e) => onChange({ full_width: e.target.checked })}
          className="h-4 w-4 accent-teal"
        />
        Full width (no side padding)
      </label>
    </div>
  );
}
