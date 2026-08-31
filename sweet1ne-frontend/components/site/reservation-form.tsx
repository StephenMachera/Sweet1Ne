"use client";

import { useEffect, useState } from "react";
import { Check, Users } from "lucide-react";
import { trackConversion } from "./analytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type Branch = { id: string; slug: string; name: string };

const OCCASIONS = [
  "Just dinner",
  "Birthday",
  "Anniversary",
  "Date night",
  "Work do",
  "Something else",
];

export function ReservationForm() {
  const [branches, setBranches] = useState<Branch[]>([]);

  const [type, setType] = useState<"table" | "private">("table");
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [occasion, setOccasion] = useState("");
  const [notes, setNotes] = useState("");
  const [marketing, setMarketing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ branchName: string; when: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/public/site/locations`)
      .then((res) => res.json())
      .then((list: Branch[]) => {
        setBranches(list);
        if (list.length === 1) setBranchId(list[0].id);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!branchId) {
      setError("Please choose which restaurant.");
      return;
    }

    setSubmitting(true);
    try {
      const requestedAt = new Date(`${date}T${time}`);

      const res = await fetch(`${API_URL}/public/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          name,
          email,
          phone,
          reservation_type: type,
          party_size: Number(partySize),
          requested_at: requestedAt.toISOString(),
          occasion: occasion || null,
          notes: notes || null,
          marketing_consent: marketing,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Something went wrong.");
      }

      const result = await res.json();

      // The event the ads actually optimise for — a click is worth nothing
      // without knowing whether it led to a booking.
      trackConversion("Lead", {
        content_category: type === "private" ? "private_hire" : "table_booking",
      });

      setDone({
        branchName: result.branch_name,
        when: requestedAt.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="border border-[var(--hairline)] p-8 text-center sm:p-12" style={{ borderRadius: "4px" }}>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--gold)]">
          <Check size={24} strokeWidth={1.5} className="text-[#0e0e0e]" />
        </span>

        <h3 className="mt-6 font-display text-3xl">Request sent</h3>

        <p className="mx-auto mt-4 max-w-sm leading-relaxed text-[var(--ivory-dim)]">
          We've got your request for {done.branchName} on {done.when}. Check your
          email — we've sent you a copy, and we'll be back in touch shortly to
          confirm.
        </p>

        <p className="mt-6 text-sm text-[var(--muted)]">
          Nothing's booked until you hear from us.
        </p>
      </div>
    );
  }

  const inputClass =
    "h-14 w-full border border-[var(--hairline-faint)] bg-[#1c1b1b] px-4 text-base text-[var(--ivory)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--gold)]";

  // Can't book yesterday.
  const today = new Date().toISOString().split("T")[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div
          role="alert"
          className="border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-4 py-3 text-sm text-[#ffb4ab]"
          style={{ borderRadius: "4px" }}
        >
          {error}
        </div>
      )}

      {/* What kind — the fork the whole form hangs on. */}
      <div>
        <label className="label-caps mb-3 block text-[var(--gold)]">
          What are you booking?
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setType("table")}
            className={`border p-5 text-left transition-colors ${
              type === "table"
                ? "border-[var(--gold)] bg-[var(--gold)]/[0.06]"
                : "border-[var(--hairline-faint)] hover:border-[var(--hairline)]"
            }`}
            style={{ borderRadius: "4px" }}
          >
            <span className="block font-display text-xl">A table</span>
            <span className="mt-1 block text-sm text-[var(--ivory-dim)]">
              Dinner, drinks, a birthday — anything up to about twelve.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setType("private")}
            className={`border p-5 text-left transition-colors ${
              type === "private"
                ? "border-[var(--gold)] bg-[var(--gold)]/[0.06]"
                : "border-[var(--hairline-faint)] hover:border-[var(--hairline)]"
            }`}
            style={{ borderRadius: "4px" }}
          >
            <span className="block font-display text-xl">Private hire</span>
            <span className="mt-1 block text-sm text-[var(--ivory-dim)]">
              A section or the whole room. Tell us what you have in mind.
            </span>
          </button>
        </div>
      </div>

      {/* Where */}
      <div>
        <label className="label-caps mb-3 block text-[var(--gold)]">Which restaurant?</label>
        <div className="grid gap-3 sm:grid-cols-2">
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => setBranchId(branch.id)}
              className={`border px-5 py-4 text-left transition-colors ${
                branchId === branch.id
                  ? "border-[var(--gold)] bg-[var(--gold)]/[0.06]"
                  : "border-[var(--hairline-faint)] hover:border-[var(--hairline)]"
              }`}
              style={{ borderRadius: "4px" }}
            >
              <span className="block text-[var(--ivory)]">{branch.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* When and how many */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="r-date" className="label-caps mb-2 block text-[var(--muted)]">
            Date
          </label>
          <input
            id="r-date"
            type="date"
            required
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
            style={{ borderRadius: "4px" }}
          />
        </div>

        <div>
          <label htmlFor="r-time" className="label-caps mb-2 block text-[var(--muted)]">
            Time
          </label>
          <input
            id="r-time"
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputClass}
            style={{ borderRadius: "4px" }}
          />
        </div>

        <div>
          <label htmlFor="r-party" className="label-caps mb-2 block text-[var(--muted)]">
            How many
          </label>
          <div className="relative">
            <Users
              size={16}
              strokeWidth={1}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              id="r-party"
              type="number"
              min="1"
              max="200"
              required
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              className={`${inputClass} pl-11`}
              style={{ borderRadius: "4px" }}
            />
          </div>
        </div>
      </div>

      {/* Who */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="r-name" className="label-caps mb-2 block text-[var(--muted)]">
            Name
          </label>
          <input
            id="r-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            style={{ borderRadius: "4px" }}
          />
        </div>

        <div>
          <label htmlFor="r-email" className="label-caps mb-2 block text-[var(--muted)]">
            Email
          </label>
          <input
            id="r-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            style={{ borderRadius: "4px" }}
          />
        </div>

        <div>
          <label htmlFor="r-phone" className="label-caps mb-2 block text-[var(--muted)]">
            Phone
          </label>
          <input
            id="r-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            style={{ borderRadius: "4px" }}
          />
        </div>
      </div>

      {/* Occasion — only for tables; private hire says it in the notes. */}
      {type === "table" && (
        <div>
          <label className="label-caps mb-3 block text-[var(--muted)]">
            What's the occasion? <span className="normal-case">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setOccasion(occasion === option ? "" : option)}
                className={`border px-4 py-2.5 text-sm transition-colors ${
                  occasion === option
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
      )}

      <div>
        <label htmlFor="r-notes" className="label-caps mb-2 block text-[var(--muted)]">
          {type === "private"
            ? "Tell us about it"
            : "Anything we should know? (optional)"}
        </label>
        <textarea
          id="r-notes"
          rows={4}
          required={type === "private"}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            type === "private"
              ? "What you're planning, roughly how many, and anything you'd like laid on."
              : "Allergies, a high chair, somewhere quiet…"
          }
          className="w-full resize-none border border-[var(--hairline-faint)] bg-[#1c1b1b] px-4 py-3.5 text-base text-[var(--ivory)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--gold)]"
          style={{ borderRadius: "4px" }}
        />
      </div>

      {/* Marketing consent — separate and unticked. Booking a table isn't
          consent to be emailed about anything else. */}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#f6d24c]"
        />
        <span className="text-sm leading-relaxed text-[var(--ivory-dim)]">
          Email me about new dishes and events too. Unsubscribe any time.
        </span>
      </label>

      <div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[var(--gold)] py-5 text-base font-semibold text-[#0e0e0e] transition-colors hover:bg-[var(--gold-deep)] disabled:opacity-60 sm:w-auto sm:px-12"
          style={{ borderRadius: "4px" }}
        >
          {submitting ? "Sending…" : "Send request"}
        </button>

        <p className="mt-4 text-sm text-[var(--muted)]">
          We'll confirm by email. Tables are held for two hours.
        </p>
      </div>
    </form>
  );
}