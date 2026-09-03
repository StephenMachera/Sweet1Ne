"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Mail,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  sent_at: string | null;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sending: "Sending…",
  sent: "Sent",
  failed: "Failed",
};

export default function CampaignsPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const canManage = hasPermission(me, "manage_marketing");
  // Campaigns are company-wide, so branch-scoped staff don't manage them.
  const isUnscoped = me?.branch_id === null;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);

  const load = useCallback(
    () =>
      apiFetch("/campaigns")
        .then(setCampaigns)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage || !isUnscoped) {
      router.replace("/admin/dashboard");
      return;
    }
    load();
  }, [meLoading, me, canManage, isUnscoped, router, load]);

  async function createDraft() {
    setCreating(true);
    setError(null);
    try {
      const draft = await apiFetch("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: "Untitled campaign",
          subject: "",
          preheader: null,
          blocks: [],
        }),
      });
      router.push(`/admin/marketing/campaigns/${draft.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that.");
      setCreating(false);
    }
  }

  async function duplicate(campaign: Campaign) {
    setError(null);
    try {
      const copy = await apiFetch(`/campaigns/${campaign.id}/duplicate`, {
        method: "POST",
      });
      router.push(`/admin/marketing/campaigns/${copy.id}`);
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

  if (meLoading || !me || !canManage || !isUnscoped) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  const drafts = campaigns.filter((c) => c.status === "draft");
  const sent = campaigns.filter((c) => c.status !== "draft");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/marketing"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <ArrowLeft size={14} />
            Marketing
          </Link>

          <h1 className="font-display text-2xl text-ink sm:text-3xl">Campaigns</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {drafts.length} in progress · {sent.length} sent
          </p>
        </div>

        <Button
          onClick={createDraft}
          disabled={creating}
          className="bg-gold text-ink hover:bg-gold/90"
        >
          <Plus size={16} className="mr-1.5" />
          {creating ? "Creating…" : "New campaign"}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-ember/25 bg-ember-soft px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/15 px-6 py-20 text-center">
          <Mail size={28} strokeWidth={1} className="mx-auto text-ink-muted" />
          <p className="mt-4 font-display text-xl text-ink">Nothing sent yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
            Build an email from blocks — a heading, some text, a picture, a
            button. It'll come out looking like Sweet1NE whatever you write.
          </p>
          <Button
            onClick={createDraft}
            disabled={creating}
            className="mt-6 bg-gold text-ink hover:bg-gold/90"
          >
            <Plus size={16} className="mr-1.5" />
            Start one
          </Button>
        </div>
      ) : (
        <>
          {drafts.length > 0 && (
            <section className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                In progress
              </p>
              {drafts.map((campaign) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  onDuplicate={() => duplicate(campaign)}
                  onDelete={() => setDeleting(campaign)}
                />
              ))}
            </section>
          )}

          {sent.length > 0 && (
            <section className="space-y-3">
              <p className="pt-2 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                Sent
              </p>
              {sent.map((campaign) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  onDuplicate={() => duplicate(campaign)}
                />
              ))}
            </section>
          )}
        </>
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-ink">
              Delete this draft?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              "{deleting?.name}" will be gone for good.
            </p>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Keep it
              </Button>
              <Button
                onClick={confirmDelete}
                className="bg-ember-soft text-ember hover:bg-ember/15"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CampaignRow({
  campaign,
  onDuplicate,
  onDelete,
}: {
  campaign: Campaign;
  onDuplicate: () => void;
  /** Only drafts can be deleted — a sent campaign is the record of what
   *  actually went to customers. */
  onDelete?: () => void;
}) {
  const statusStyles: Record<string, string> = {
    draft: "bg-ink/5 text-ink-muted",
    sending: "bg-gold-soft text-[#8a6a28]",
    sent: "bg-sage-soft text-sage",
    failed: "bg-ember-soft text-ember",
  };

  return (
    <div className="rounded-xl border border-ink/8 bg-white shadow-[0_1px_3px_rgba(20,24,28,0.04)]">
      <div className="flex flex-wrap items-center gap-4 p-4 sm:px-5">
        <Link
          href={`/admin/marketing/campaigns/${campaign.id}`}
          className="min-w-0 flex-1"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{campaign.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                statusStyles[campaign.status]
              }`}
            >
              {STATUS_LABELS[campaign.status] ?? campaign.status}
            </span>
          </div>

          <p className="mt-1 truncate text-sm text-ink-muted">
            {campaign.subject || "No subject yet"}
          </p>

          <p className="mt-1.5 text-xs text-ink-muted">
            {campaign.sent_at ? (
              <>
                Sent {new Date(campaign.sent_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                to {campaign.sent_count}{" "}
                {campaign.sent_count === 1 ? "person" : "people"}
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
          </p>
        </Link>

        <div className="flex shrink-0 gap-1">
          <button
            onClick={onDuplicate}
            title="Duplicate"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <Copy size={15} />
          </button>

          {onDelete && (
            <button
              onClick={onDelete}
              title="Delete"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-ember-soft hover:text-ember"
            >
              <Trash2 size={15} />
            </button>
          )}

          <Link
            href={`/admin/marketing/campaigns/${campaign.id}`}
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            {campaign.status === "draft" ? "Edit" : "View"}
            <Send size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}