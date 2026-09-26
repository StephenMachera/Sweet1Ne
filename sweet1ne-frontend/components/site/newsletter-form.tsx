"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export function NewsletterForm({
  variant = "default",
  source = "website",
  onSubscribed,
}: {
  variant?: "default" | "order" | "guest";
  // Which real form this came from — the table sign-in step passes "qr" so
  // Leads can tell it apart from the site footer's own form.
  source?: string;
  // Fires a beat after the confirmation shows, so a caller that gated
  // something on this (the table sign-in step) can move on. Existing
  // callers that don't pass it are unaffected.
  onSubscribed?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Please tick the box so we know it's alright to email you.");
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch(`${API_URL}/public/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consented: true, source }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
      if (onSubscribed) setTimeout(onSubscribed, 1400);
    } catch {
      setStatus("idle");
      setError("Something went wrong. Try again in a moment.");
    }
  }

  const guestVariant = variant === "guest";
  const orderVariant = variant === "order";

  if (status === "done") {
    if (guestVariant) {
      return (
        <div className="flex items-center gap-3 rounded-xl border border-guest-border bg-guest-card px-5 py-4">
          <Check size={18} strokeWidth={1} className="shrink-0 text-guest-accent" />
          <p className="text-sm text-guest-muted">You&apos;re on the list — thank you.</p>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 border border-[var(--hairline)] px-5 py-6" style={{ borderRadius: "4px" }}>
        <Check size={18} strokeWidth={1} className="shrink-0 text-[var(--gold)]" />
        <p className="text-sm text-[var(--ivory-dim)]">
          You&apos;re on the list. We&apos;ll be in touch when there&apos;s something worth
          telling you.
        </p>
      </div>
    );
  }

  if (guestVariant) {
    return (
      <form onSubmit={handleSubmit} className="grid gap-3 text-left">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="h-12 w-full rounded-xl border border-guest-border bg-guest-card px-4 text-base text-guest-text outline-none transition-colors placeholder:text-guest-muted focus:border-guest-accent"
        />
        <label className="flex cursor-pointer items-start gap-2 text-sm text-guest-muted">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-guest-accent"
          />
          <span>Yes, email me about offers and news. Unsubscribe any time.</span>
        </label>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={status === "sending"}
          className="h-12 rounded-full bg-guest-accent text-sm font-medium text-white transition-opacity disabled:opacity-60"
        >
          {status === "sending" ? "Joining…" : "Continue"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={orderVariant ? "grid gap-[0.7rem] text-left" : "space-y-4"}>
      <div className={orderVariant ? "flex gap-[0.45rem]" : "flex gap-3"}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className={orderVariant
            ? "h-[2.85rem] min-w-0 flex-1 border border-[rgba(201,162,74,0.35)] bg-transparent px-[0.85rem] text-[0.95rem] text-[var(--ivory)] outline-none transition-colors placeholder:text-[var(--ivory-dim)] focus:border-[var(--gold)]"
            : "h-14 flex-1 border border-[var(--hairline-faint)] bg-[#1c1b1b] px-4 text-base text-[var(--ivory)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--gold)]"}
          style={{ borderRadius: "4px" }}
        />
        <button
          type="submit"
          disabled={status === "sending"}
          aria-label="Subscribe"
          className={orderVariant
            ? "grid h-[2.85rem] shrink-0 place-items-center border border-[rgba(201,162,74,0.9)] px-[1.05rem] text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--gold)] transition-colors hover:bg-[var(--gold)] hover:text-[#0e0e0e] disabled:opacity-60"
            : "flex h-14 w-14 shrink-0 items-center justify-center bg-[var(--gold)] text-[#0e0e0e] transition-colors hover:bg-[var(--gold-deep)] disabled:opacity-60"}
          style={{ borderRadius: "4px" }}
        >
          {orderVariant ? "Join" : <ArrowRight size={20} strokeWidth={1.5} />}
        </button>
      </div>

      <label className="flex cursor-pointer items-start gap-[0.55rem]">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#f6d24c]"
        />
        <span className={orderVariant ? "text-[0.78rem] text-[var(--ivory-dim)]" : "text-xs leading-relaxed text-[var(--muted)]"}>
          Yes, email me about new dishes and events. Unsubscribe any time.
        </span>
      </label>

      {error && <p className="text-xs text-[#ffb4ab]">{error}</p>}
    </form>
  );
}