"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export function NewsletterForm() {
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
        body: JSON.stringify({ email, consented: true }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("idle");
      setError("Something went wrong. Try again in a moment.");
    }
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-3 border border-[var(--hairline)] px-5 py-6" style={{ borderRadius: "4px" }}>
        <Check size={18} strokeWidth={1} className="shrink-0 text-[var(--gold)]" />
        <p className="text-sm text-[var(--ivory-dim)]">
          You're on the list. We'll be in touch when there's something worth
          telling you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="h-14 flex-1 border border-[var(--hairline-faint)] bg-[#1c1b1b] px-4 text-base text-[var(--ivory)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--gold)]"
          style={{ borderRadius: "4px" }}
        />
        <button
          type="submit"
          disabled={status === "sending"}
          aria-label="Subscribe"
          className="flex h-14 w-14 shrink-0 items-center justify-center bg-[var(--gold)] text-[#0e0e0e] transition-colors hover:bg-[var(--gold-deep)] disabled:opacity-60"
          style={{ borderRadius: "4px" }}
        >
          <ArrowRight size={20} strokeWidth={1.5} />
        </button>
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#f6d24c]"
        />
        <span className="text-xs leading-relaxed text-[var(--muted)]">
          Yes, email me about new dishes and events. Unsubscribe any time.
        </span>
      </label>

      {error && <p className="text-xs text-[#ffb4ab]">{error}</p>}
    </form>
  );
}