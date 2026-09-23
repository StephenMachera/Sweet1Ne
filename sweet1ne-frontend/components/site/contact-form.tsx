"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { Check } from "lucide-react";
import { trackConversion } from "./analytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Mirrors app/schemas/reservation.py's _looks_like_a_name — same rule, so a
// visitor gets told immediately instead of waiting on a round trip just to
// be rejected by the same check on the server.
function looksLikeAName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return false;
  if (!trimmed.includes(" ")) return false;
  return /^[a-zA-Z '.-]+$/.test(trimmed);
}

// FastAPI returns a plain string for a raised HTTPException, but a list of
// {msg, loc, ...} objects for a Pydantic validation failure — this reads
// either shape and always returns something readable.
function extractErrorMessage(body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const msg = detail[0]?.msg;
    if (typeof msg === "string") return msg.replace(/^Value error,\s*/, "");
  }
  return "Something went wrong.";
}

// Cloudflare's script attaches this once it loads — not shipped with any
// TypeScript types of its own, so this describes just the two calls used
// below.
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

const TOPICS = [
  "General question",
  "Private hire",
  "Press",
  "Working with us",
  "Something else",
];

type Branch = { id: string; name: string };

/**
 * Enquiries go through the reservations table rather than a separate inbox —
 * staff already check that list because bookings depend on it, so a question
 * landing there actually gets seen.
 */
export function ContactForm() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [message, setMessage] = useState("");
  // Honeypot — real visitors never see this field (hidden below); a bot
  // filling in every input it finds gives itself away by filling this one.
  const [website, setWebsite] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Turnstile — the widget below issues a one-time token once a visitor
  // completes it; that token (not any of the form fields) is what proves
  // the submission came from a real browser and not a bot script.
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/public/site/locations`)
      .then((res) => res.json())
      .then((list: Branch[]) => {
        setBranches(list);
        if (!branchId && list.length > 0) setBranchId(list[0].id);
      })
      .catch(() => {});
  }, []);

  // Runs once the Cloudflare script has loaded (see the <Script onLoad>
  // below) — that script exposes window.turnstile, which we then use to
  // draw the widget into the empty <div> further down.
  useEffect(() => {
    if (!turnstileReady || !turnstileContainerRef.current || !window.turnstile) return;
    if (!TURNSTILE_SITE_KEY) return;

    turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: setTurnstileToken,
      // A token left too long unused expires; clearing it here means
      // handleSubmit correctly asks for a fresh one instead of sending a
      // dead token to the backend.
      "expired-callback": () => setTurnstileToken(""),
    });
  }, [turnstileReady]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!looksLikeAName(name)) {
      setError("Please enter your full name (first and last).");
      return;
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("Please complete the verification below before sending.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/public/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          name,
          email,
          phone,
          reservation_type: "enquiry",
          occasion: topic,
          notes: message,
          website,
          turnstile_token: turnstileToken,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(body));
      }

      trackConversion("Contact", { content_category: topic });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      // Turnstile tokens are single-use — whether the backend rejected it or
      // some other error happened, the old token is now spent either way,
      // so get a fresh one ready for the retry.
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
      }
      setTurnstileToken("");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    "w-full border border-[rgba(229,226,225,.18)] bg-[#111] px-[0.8rem] py-[0.65rem] text-[0.95rem] text-[var(--ivory)] outline-none transition-colors focus:border-[var(--gold)]";

  const labelClass =
    "mb-1.5 block text-[0.68rem] uppercase tracking-[0.14em] text-[var(--gold)]";

  if (done) {
    return (
      <div className="border border-[rgba(201,162,74,.4)] p-8 text-center sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--gold)]">
          <Check size={24} strokeWidth={1.5} className="text-[#0e0e0e]" />
        </span>

        <h3 className="mt-6 font-display text-2xl">Message sent</h3>

        <p className="mx-auto mt-3 max-w-sm leading-relaxed text-[var(--ivory-dim)]">
          We&apos;ve got it, and we&apos;ve emailed you a copy. Someone will come back to
          you — usually within a day.
        </p>

        <p className="mt-5 text-[0.85rem] text-[var(--muted)]">
          Need an answer sooner? The phone is quicker.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="lazyOnload"
          onLoad={() => setTurnstileReady(true)}
        />
      )}

      {error && (
        <p
          role="alert"
          className="border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-4 py-3 text-[0.9rem] text-[#ffb4ab]"
        >
          {error}
        </p>
      )}

      {/* Honeypot — off-screen, never focusable or visible to a real
          visitor, tabIndex -1 so keyboard/tab order skips it too. */}
      <div aria-hidden style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>What&apos;s it about?</span>
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className={fieldClass}
        >
          {TOPICS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Phone</span>
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Which restaurant?</span>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={fieldClass}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Your message</span>
        <textarea
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${fieldClass} resize-y`}
        />
      </label>

      {TURNSTILE_SITE_KEY && <div ref={turnstileContainerRef} />}

      <div>
        <button
          type="submit"
          disabled={submitting || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
          className="border border-[rgba(201,162,74,.9)] px-[1.15rem] py-[0.65rem] text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--gold)] transition-colors hover:bg-[var(--gold)] hover:text-[#0e0e0e] disabled:opacity-50"
          style={{ borderRadius: "3px" }}
        >
          {submitting ? "Sending…" : "Send message"}
        </button>

        <p className="mt-4 text-[0.85rem] text-[var(--muted)]">
          Booking a table?{" "}
          <Link
            href="/locations"
            className="border-b border-[rgba(201,162,74,.55)] pb-[0.1rem] text-[var(--ivory)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            Find Us
          </Link>{" "}
          — that&apos;s quicker than a message.
        </p>
      </div>
    </form>
  );
}