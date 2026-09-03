"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, Save, Send } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { BlockEditor, type Block } from "./block-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  blocks: Block[];
  status: string;
  sent_count: number;
};

export function CampaignEditor({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const { me } = useMe();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);

  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  useEffect(() => {
    apiFetch(`/campaigns/${campaignId}`)
      .then((data: Campaign) => {
        setCampaign(data);
        setName(data.name);
        setSubject(data.subject);
        setPreheader(data.preheader ?? "");
        setBlocks(data.blocks);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    apiFetch("/newsletter/stats")
      .then((s) => setSubscriberCount(s.subscribed))
      .catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    if (me?.email) setTestEmail(me.email);
  }, [me]);

  // Re-render the preview as they type, but not on every keystroke — the
  // render is a network call.
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);

    previewTimer.current = setTimeout(() => {
      apiFetch("/campaigns/preview", {
        method: "POST",
        body: JSON.stringify({ name, subject, preheader: preheader || null, blocks }),
      })
        .then((res) => setPreviewHtml(res.html))
        .catch(() => {});
    }, 400);
  }, [name, subject, preheader, blocks]);

  useEffect(() => {
    if (!loading) refreshPreview();
  }, [loading, refreshPreview]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/campaigns/${campaignId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, subject, preheader: preheader || null, blocks }),
      });
      setCampaign(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTestSending(true);
    setError(null);
    try {
      // Save first — the test sends what's stored, not what's on screen.
      await save();
      await apiFetch(`/campaigns/${campaignId}/test`, {
        method: "POST",
        body: JSON.stringify({ email: testEmail }),
      });
      setTestSent(true);
      setTimeout(() => {
        setTestOpen(false);
        setTestSent(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the test.");
    } finally {
      setTestSending(false);
    }
  }

  async function sendToList() {
    setSending(true);
    setError(null);
    try {
      await save();
      await apiFetch(`/campaigns/${campaignId}/send`, { method: "POST" });
      setSendOpen(false);
      router.push("/admin/marketing/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send.");
      setSending(false);
    }
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (!campaign) return <p className="text-sm text-ink-muted">Campaign not found.</p>;

  const isSent = campaign.status !== "draft";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={() => router.push("/admin/marketing/campaigns")}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <ArrowLeft size={14} />
            All campaigns
          </button>

          <h1 className="font-display text-2xl text-ink sm:text-3xl">{name || "Untitled"}</h1>

          {isSent && (
            <p className="mt-1 text-sm text-sage">
              Sent to {campaign.sent_count} {campaign.sent_count === 1 ? "person" : "people"}
            </p>
          )}
        </div>

        {!isSent && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setTestOpen(true)}>
              <Eye size={16} className="mr-1.5" />
              Send test
            </Button>

            <Button variant="ghost" onClick={save} disabled={saving}>
              <Save size={16} className="mr-1.5" />
              {saving ? "Saving…" : saved ? "Saved" : "Save"}
            </Button>

            <Button
              onClick={() => setSendOpen(true)}
              disabled={blocks.length === 0}
              className="bg-gold text-ink hover:bg-gold/90"
            >
              <Send size={16} className="mr-1.5" />
              Send
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-ember/25 bg-ember-soft px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_480px]">
        {/* Editor */}
        <div className="space-y-5">
          <div className="space-y-4 rounded-xl border border-ink/8 bg-white p-5 shadow-[0_1px_3px_rgba(20,24,28,0.04)]">
            <div className="space-y-1">
              <Label htmlFor="c-name">Campaign name</Label>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSent}
                placeholder="e.g. Valentine's 2027"
              />
              <p className="text-xs text-ink-muted">Just for you — recipients never see it.</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="c-subject">Subject line</Label>
              <Input
                id="c-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSent}
                placeholder="e.g. Table for two this Valentine's?"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="c-preheader">Preview text</Label>
              <Input
                id="c-preheader"
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                disabled={isSent}
                placeholder="The line inboxes show next to the subject"
              />
            </div>
          </div>

          {isSent ? (
            <div className="rounded-xl border border-ink/8 bg-white p-5">
              <p className="text-sm text-ink-muted">
                This campaign has been sent, so it can't be edited — it's the
                record of what went out. Duplicate it to make a new version.
              </p>
            </div>
          ) : (
            <BlockEditor blocks={blocks} onChange={setBlocks} />
          )}
        </div>

        {/* Preview — the real email HTML in an iframe, so its styles can't
            leak into the dashboard and vice versa. */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Preview
          </p>
          <div className="overflow-hidden rounded-xl border border-ink/8">
            <iframe
              srcDoc={previewHtml}
              title="Email preview"
              className="h-[70vh] w-full bg-[#0e0e0e]"
            />
          </div>
        </div>
      </div>

      {/* Test send */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-ink">
              Send yourself a test
            </DialogTitle>
          </DialogHeader>

          {testSent ? (
            <p className="flex items-center gap-2 text-sm text-sage">
              <Check size={16} />
              On its way. Check your inbox.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-ink-muted">
                Worth checking how it looks on a phone before it goes to
                everyone.
              </p>

              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
              />

              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setTestOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={sendTest}
                  disabled={testSending || !testEmail}
                  className="bg-gold text-ink hover:bg-gold/90"
                >
                  {testSending ? "Sending…" : "Send test"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send for real */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-ink">
              Send to everyone?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              This goes to{" "}
              <span className="font-medium text-ink">
                {subscriberCount ?? "…"} {subscriberCount === 1 ? "person" : "people"}
              </span>{" "}
              on the list. There's no recalling it once it's gone.
            </p>

            <div className="rounded-lg bg-gold-soft px-4 py-3 text-sm text-[#8a6a28]">
              Sent yourself a test first? It's the only way to know how it
              actually looks.
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setSendOpen(false)} disabled={sending}>
                Not yet
              </Button>
              <Button
                onClick={sendToList}
                disabled={sending}
                className="bg-gold text-ink hover:bg-gold/90"
              >
                {sending ? "Starting…" : "Send it"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}