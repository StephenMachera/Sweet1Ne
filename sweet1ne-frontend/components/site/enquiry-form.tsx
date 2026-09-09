"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { trackConversion } from "./analytics";
import { openBookingModal } from "./booking-modal";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type Branch = { id: string; slug: string; name: string };

const SUBJECTS = [
  "General question",
  "Private hire",
  "Press",
  "Working with us",
  "Something else",
];

/**
 * General enquiries go through the reservations table rather than a separate
 * inbox — staff already check that list because bookings depend on it, so a
 * question landing there actually gets seen.
 */
export function EnquiryForm() {
  const [branches, setBranches] = useState<Branch[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The dropdown has to be built from real branches, not the static
  // marketing copy — that content's slugs don't correspond to any actual
  // row in the database, so a selection made from it could never resolve
  // to a real branch id.
  useEffect(() => {
    fetch(`${API_URL}/public/site/locations`)
      .then((r) => r.json())
      .then((list: Branch[]) => setBranches(list))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Falls back to the first branch — an enquiry has to land somewhere,
      // and "either" is a reasonable default for a general question.
      const targetBranchId = branchId || branches[0]?.id;

      if (!targetBranchId) {
        throw new Error("We couldn't reach that restaurant right now. Please try again.");
      }

      const res = await fetch(`${API_URL}/public/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: targetBranchId,
          name,
          email,
          phone,
          reservation_type: "enquiry",
          occasion: subject,
          notes: message,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Something went wrong.");
      }

      trackConversion("Contact", { content_category: subject });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        className="border border-[var(--hairline)] p-8 text-center sm:p-10"
        style={{ borderRadius: "4px" }}
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--gold)]">
          <Check size={24} strokeWidth={1.5} className="text-[#0e0e0e]" />
        </span>

        <h3 className="mt-6 font-display text-2xl">Message sent</h3>

        <p className="mx-auto mt-3 max-w-sm leading-relaxed text-[var(--ivory-dim)]">
          We've got it, and we've emailed you a copy. Someone will come back to
          you — usually within a day.
        </p>

        <p className="mt-5 text-sm text-[var(--muted)]">
          Need an answer sooner? The phone is quicker.
        </p>
      </div>
    );
  }

  const inputClass =
    "h-14 w-full border border-[var(--hairline-faint)] bg-[#1c1b1b] px-4 text-base text-[var(--ivory)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--gold)]";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-4 py-3 text-sm text-[#ffb4ab]"
          style={{ borderRadius: "4px" }}
        >
          {error}
        </div>
      )}

      {/* What it's about — chips rather than a dropdown, since there are
          few options and tapping beats a select on a phone. */}
      <div>
        <label className="label-caps mb-3 block text-[var(--gold)]">
          What's it about?
        </label>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSubject(option)}
              className={`border px-4 py-2.5 text-sm transition-colors ${
                subject === option
                  ? "border-[var(--gold)] text-[var(--gold)]"
                  : "border-[var(--hairline-faint)] text-[var(--ivory-dim)] hover:border-[var(--hairline)]"
              }`}
              style={{ borderRadius: "4px" }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="e-name" className="label-caps mb-2 block text-[var(--muted)]">
            Name
          </label>
          <input
            id="e-name"
            required
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            className={inputClass}
            style={{ borderRadius: "4px" }}
          />
        </div>

        <div>
          <label htmlFor="e-email" className="label-caps mb-2 block text-[var(--muted)]">
            Email
          </label>
          <input
            id="e-email"
            type="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className={inputClass}
            style={{ borderRadius: "4px" }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="e-phone" className="label-caps mb-2 block text-[var(--muted)]">
            Phone
          </label>
          <input
            id="e-phone"
            type="tel"
            required
            value={phone}
            onChange={(ev) => setPhone(ev.target.value)}
            className={inputClass}
            style={{ borderRadius: "4px" }}
          />
        </div>

        <div>
          <label htmlFor="e-branch" className="label-caps mb-2 block text-[var(--muted)]">
            Which restaurant?
          </label>
          <select
            id="e-branch"
            value={branchId}
            onChange={(ev) => setBranchId(ev.target.value)}
            className={inputClass}
            style={{ borderRadius: "4px" }}
          >
            <option value="">Either / not sure</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="e-message" className="label-caps mb-2 block text-[var(--muted)]">
          Your message
        </label>
        <textarea
          id="e-message"
          rows={5}
          required
          value={message}
          onChange={(ev) => setMessage(ev.target.value)}
          placeholder="Tell us what you'd like to know."
          className="w-full resize-none border border-[var(--hairline-faint)] bg-[#1c1b1b] px-4 py-3.5 text-base text-[var(--ivory)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--gold)]"
          style={{ borderRadius: "4px" }}
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[var(--gold)] py-5 text-base font-semibold text-[#0e0e0e] transition-colors hover:bg-[var(--gold-deep)] disabled:opacity-60 sm:w-auto sm:px-12"
          style={{ borderRadius: "4px" }}
        >
          {submitting ? "Sending…" : "Send message"}
        </button>

        <p className="mt-4 text-sm text-[var(--muted)]">
          Booking a table? The{" "}
          <button
            type="button"
            onClick={openBookingModal}
            className="border-b border-[var(--ivory)]/30 hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            reservations page
          </button>{" "}
          is quicker.
        </p>
      </div>
    </form>
  );
}