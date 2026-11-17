"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Body, useJson } from "@/components/reports/report-kit";

type Setting = {
  key: string;
  group: string;
  label: string;
  help: string;
  unit: string;
  default: number;
  minimum: number;
  maximum: number;
  value: number;
  is_changed: boolean;
};

type Res = { groups: string[]; settings: Setting[] };

const BLURB: Record<string, string> = {
  General: "How much the page shows, and how careful it is before saying anything.",
  "Kitchen and service": "When you are busy, when you are not, and when orders go wrong.",
  Menu: "What is missing from the menu, what is fading, and what has stopped.",
  Marketing: "Campaigns, links and pages. Only these are visible to the marketing team.",
  "Guests and money": "What a visit is worth, where the QR journey loses people, and how the branches compare.",
};

const UNITS: Record<string, string> = { percent: "%", days: "days", weeks: "weeks", hours: "hours", count: "" };

export function InsightsSettings({ onWorkOut, working }: { onWorkOut: () => void; working: boolean }) {
  const [tick, setTick] = useState(0);
  const res = useJson<Res>(`/insights/settings?_=${tick}`);

  return (
    <Body res={res}>
      {(data) => (
        <Form
          key={tick}
          data={data}
          onSaved={() => setTick((t) => t + 1)}
          onWorkOut={onWorkOut}
          working={working}
        />
      )}
    </Body>
  );
}

function Form({
  data,
  onSaved,
  onWorkOut,
  working,
}: {
  data: Res;
  onSaved: () => void;
  onWorkOut: () => void;
  working: boolean;
}) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const changedFromDefault = data.settings.filter((s) => s.is_changed).length;

  const dirty = useMemo(
    () =>
      data.settings.filter((s) => {
        const raw = edits[s.key];
        return raw !== undefined && raw !== "" && Number(raw) !== s.value;
      }),
    [data.settings, edits]
  );

  const outOfRange = (s: Setting) => {
    const raw = edits[s.key];
    if (raw === undefined || raw === "") return false;
    const n = Number(raw);
    return Number.isNaN(n) || n < s.minimum || n > s.maximum;
  };

  async function save() {
    const bad = dirty.find(outOfRange);
    if (bad) {
      setMessage({ ok: false, text: `${bad.label} has to be between ${bad.minimum} and ${bad.maximum}.` });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const values = Object.fromEntries(dirty.map((s) => [s.key, Number(edits[s.key])]));
      const out = await apiFetch("/insights/settings", { method: "PUT", body: JSON.stringify({ values }) });
      setMessage({ ok: true, text: out?.note ?? "Saved." });
      setEdits({});
      onSaved();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." });
    } finally {
      setSaving(false);
    }
  }

  async function reset(key?: string) {
    if (!key && !window.confirm("Put every number back to its default?")) return;
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch("/insights/settings/reset", { method: "POST", body: JSON.stringify(key ? { key } : {}) });
      setEdits({});
      setMessage({ ok: true, text: key ? "Put back to the default." : "Everything is back to the defaults." });
      onSaved();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Couldn't reset." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="in-bar">
        <div className="in-bar-actions">
          <button type="button" className="in-btn" onClick={() => reset()} disabled={saving || changedFromDefault === 0}>
            Put everything back to default
          </button>
          <button type="button" className="in-btn is-primary" onClick={save} disabled={saving || dirty.length === 0}>
            {saving ? "Saving…" : dirty.length ? `Save ${dirty.length} ${dirty.length === 1 ? "change" : "changes"}` : "Save changes"}
          </button>
        </div>
      </div>

      {message && (
        <p className={message.ok ? "in-ok" : "in-error"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      <div className="in-strip">
        <div>
          <strong>
            {changedFromDefault} of {data.settings.length} changed from the default
          </strong>
          <p>
            New numbers apply the next time the insights are worked out, which is overnight. Nothing on the Insights tab
            changes until then.
          </p>
        </div>
        <button type="button" className="in-btn" onClick={onWorkOut} disabled={working}>
          {working ? "Working…" : "Work them out now"}
        </button>
      </div>

      {data.groups.map((g) => (
        <section key={g} className="in-section" aria-label={g}>
          <h2 className="rg-h2">{g}</h2>
          <p className="in-sub">{BLURB[g]}</p>
          <div className="in-settings">
            {data.settings
              .filter((s) => s.group === g)
              .map((s) => {
                const raw = edits[s.key];
                const shown = raw ?? String(s.value);
                const bad = outOfRange(s);
                const changed = s.is_changed || (raw !== undefined && raw !== "" && Number(raw) !== s.default);
                return (
                  <div key={s.key} className="in-setting">
                    <div className="in-setting-text">
                      <label htmlFor={`s-${s.key}`}>{s.label}</label>
                      <p>{s.help}</p>
                      <div className="in-setting-meta">
                        <span>
                          Default {s.default} · between {s.minimum} and {s.maximum}
                        </span>
                        <span className={`in-pill is-small${changed ? " is-fair" : ""}`}>{changed ? "Changed" : "Default"}</span>
                        {s.is_changed && (
                          <button type="button" className="in-link" onClick={() => reset(s.key)} disabled={saving}>
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="in-setting-input">
                      <input
                        id={`s-${s.key}`}
                        type="number"
                        inputMode="decimal"
                        min={s.minimum}
                        max={s.maximum}
                        value={shown}
                        aria-invalid={bad}
                        className={`${bad ? "is-bad" : ""}${changed ? " is-changed" : ""}`}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [s.key]: e.target.value }))}
                      />
                      <span>{UNITS[s.unit] ?? ""}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}

      <section className="in-section" aria-labelledby="in-limits">
        <h2 id="in-limits" className="rg-h2">Worth knowing</h2>
        <article className="in-card">
          <div>
            <h3>Lower thresholds mean more cards and less certainty</h3>
            <p className="in-detail">
              Every number here is a line between “worth saying” and “noise”. Lowering one does not find more truth, it lowers
              the bar, so each card rests on less. The confidence label on a card tells you how far above its own minimum it got.
            </p>
          </div>
          <div>
            <h3>These apply to the whole company</h3>
            <p className="in-detail">
              One set of numbers for both branches, and only central staff can see or change this tab. Branch managers see the
              insights, not the dials behind them.
            </p>
          </div>
          <div>
            <h3>Out-of-range values are refused</h3>
            <p className="in-detail">
              Each setting has a range it has to stay inside, checked when you save and again when an insight reads it. Saving
              is all or nothing, so one bad value leaves nothing half-applied.
            </p>
          </div>
        </article>
      </section>
    </>
  );
}
