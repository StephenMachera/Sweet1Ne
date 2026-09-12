"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { trackConversion } from "./analytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

const TOPICS = [
  "General question",
  "Private hire",
  "Press",
  "Working with us",
  "Something else",
];

const RESTAURANTS = [
  { value: "", label: "Either / not sure" },
  { value: "lewisham", label: "Lewisham" },
  { value: "chingford", label: "Chingford" },
];

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
  const [restaurant, setRestaurant] = useState("");
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/public/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Falls back to the first branch — an enquiry has to land
          // somewhere, and "either" is a reasonable default.
          branch: restaurant || "lewisham",
          name,
          email,
          phone,
          reservation_type: "enquiry",
          occasion: topic,
          notes: message,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Something went wrong.");
      }

      trackConversion("Contact", { content_category: topic });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
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
          We've got it, and we've emailed you a copy. Someone will come back to
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
      {error && (
        <p
          role="alert"
          className="border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-4 py-3 text-[0.9rem] text-[#ffb4ab]"
        >
          {error}
        </p>
      )}

      <label className="block">
        <span className={labelClass}>What's it about?</span>
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
            value={restaurant}
            onChange={(e) => setRestaurant(e.target.value)}
            className={fieldClass}
          >
            {RESTAURANTS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
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

      <div>
        <button
          type="submit"
          disabled={submitting}
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
          — that's quicker than a message.
        </p>
      </div>
    </form>
  );
}