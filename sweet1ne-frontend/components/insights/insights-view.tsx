"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Body, Empty, Table, useJson } from "@/components/reports/report-kit";
import { InsightsSettings } from "@/components/insights/insights-settings";

type Card = {
  fingerprint: string;
  rule_title: string;
  subject: string | null;
  branch: string | null;
  scope: "branch" | "company";
  headline: string;
  detail: string;
  suggestion: string;
  evidence: Record<string, unknown>;
  confidence: "early" | "fair" | "solid";
  window_days: number;
  days_old: number;
  feedback: { action: string } | null;
};

type Waiting = { source: string; label: string; note: string; state: string; insights_waiting: string[] };

type Page = {
  window_days: number;
  not_enough_data: boolean;
  orders_in_window: number | null;
  min_orders_to_trust: number;
  reason: string | null;
  run: { message: string; state: string; refresh_started: boolean } | null;
  cards: Card[];
  more: Card[];
  hidden: Card[];
  counts: { visible: number; shown: number; hidden: number };
  waiting_on: Waiting[];
};

type Taken = {
  days: number;
  items: {
    rule_key: string;
    rule_title: string;
    done: number;
    not_useful: number;
    snoozed: number;
    acted_on_share: number | null;
  }[];
};

const CONFIDENCE = { early: "Early days", fair: "Fair", solid: "Solid" } as const;

const STATE_LABEL: Record<string, string> = {
  not_connected: "Not connected",
  quiet: "Quiet lately",
  connected: "Connected",
};

// Evidence comes straight from the rule as a loose object, so the figures strip
// is built from whichever plain values are in it. Settings-like keys (window,
// thresholds) are left out: they explain the rule, they aren't the finding.
const SKIP_KEYS = /(^|_)(window|threshold|min|max|compared)(_|$)|^(id|source)$/;

function humanise(key: string): string {
  const s = key.replace(/_/g, " ").replace(/\bpercent\b/, "%").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatValue(key: string, v: number | string | boolean): string {
  if (typeof v === "number") {
    if (/(rate|share|percent|pct)/.test(key) && Math.abs(v) <= 1) return `${Math.round(v * 1000) / 10}%`;
    if (/(revenue|price|spend|value|average)/.test(key)) return `£${v.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
    return v.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  }
  return String(v);
}

export function figuresOf(evidence: Record<string, unknown>): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const walk = (obj: Record<string, unknown>, prefix = "") => {
    for (const [key, v] of Object.entries(obj)) {
      if (out.length >= 4) return;
      if (SKIP_KEYS.test(key)) continue;
      if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
        out.push({ label: humanise(prefix ? `${prefix} ${key}` : key), value: formatValue(key, v) });
      } else if (v && !Array.isArray(v) && typeof v === "object" && !prefix) {
        walk(v as Record<string, unknown>, key);
      }
    }
  };
  walk(evidence);
  return out;
}

function ageOf(days: number): string {
  if (days <= 0) return "new today";
  if (days === 1) return "new yesterday";
  if (days < 7) return `true for ${days} days`;
  const weeks = Math.round(days / 7);
  return weeks <= 1 ? "true for a week" : `true for ${weeks} weeks`;
}

export function InsightsView({
  branchId = "",
  central,
}: {
  /** Central staff can narrow to one branch; branch staff are scoped server-side. */
  branchId?: string;
  central: boolean;
}) {
  const [tab, setTab] = useState<"insights" | "settings">("insights");
  const [tick, setTick] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState("");

  const q = `${branchId ? `branch_id=${branchId}&` : ""}_=${tick}`;
  const page = useJson<Page>(tab === "insights" ? `/insights?${q}` : null);
  const taken = useJson<Taken>(tab === "insights" && central ? `/insights/advice-taken?_=${tick}` : null);

  async function act(fingerprint: string, action: "done" | "not_useful" | "snoozed") {
    setBusy(fingerprint + action);
    setProblem("");
    try {
      await apiFetch("/insights/feedback", { method: "POST", body: JSON.stringify({ fingerprint, action }) });
      setTick((t) => t + 1);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(null);
    }
  }

  async function workOutNow() {
    setBusy("refresh");
    setProblem("");
    try {
      await apiFetch("/insights/refresh", { method: "POST" });
      setTick((t) => t + 1);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Couldn't work them out.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="in-head">
        <p className="admin-dek">
          {tab === "insights"
            ? "What the system noticed in your own numbers, and what to do about it."
            : "The numbers each insight uses to decide whether something is worth telling you about."}
        </p>
        {central && tab === "insights" && (
          <button type="button" className="in-btn is-primary" onClick={workOutNow} disabled={busy === "refresh"}>
            {busy === "refresh" ? "Working…" : "Work them out now"}
          </button>
        )}
      </div>

      {central && (
        <div className="in-tabs" role="tablist" aria-label="Insights tabs">
          {(["insights", "settings"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "is-on" : undefined}
              onClick={() => setTab(t)}
            >
              {t === "insights" ? "Insights" : "Settings"}
            </button>
          ))}
        </div>
      )}

      {problem && <p className="in-error" role="alert">{problem}</p>}

      {tab === "settings" && central ? (
        <InsightsSettings onWorkOut={workOutNow} working={busy === "refresh"} />
      ) : (
        <Body res={page}>
          {(p) => {
            const visibleCards = showMore ? [...p.cards, ...p.more] : p.cards;
            return (
              <>
                {p.run && (
                  <p className="in-meta">
                    {p.run.message} Over the last {p.window_days} days.
                    {p.counts.visible > 0 && (
                      <>
                        {" "}
                        <span aria-hidden>·</span> Showing {Math.min(visibleCards.length, p.counts.visible)} of{" "}
                        {p.counts.visible}.
                      </>
                    )}
                    {p.run.refresh_started && " Fresh ones are being worked out now: reload in a moment."}
                  </p>
                )}

                {visibleCards.length > 0 && (
                  <section className="in-cards" aria-label="Insights">
                    {visibleCards.map((c) => {
                      const figures = figuresOf(c.evidence);
                      return (
                        <article key={c.fingerprint} className="in-card">
                          <div className="in-labels">
                            <span className="in-rule">{c.rule_title}</span>
                            <span className={`in-pill is-${c.confidence}`}>{CONFIDENCE[c.confidence] ?? c.confidence}</span>
                            <span className="in-pill">{c.scope === "branch" ? c.branch ?? "One branch" : "Company-wide"}</span>
                            <span className="in-age">{ageOf(c.days_old)}</span>
                          </div>
                          <h2>{c.headline}</h2>
                          <p className="in-detail">{c.detail}</p>
                          {figures.length > 0 && (
                            <div className="in-figures">
                              {figures.map((f) => (
                                <div key={f.label}>
                                  <div className="in-fl">{f.label}</div>
                                  <div className="in-fv">{f.value}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="in-try">
                            <div className="in-try-l">Worth trying</div>
                            <p>{c.suggestion}</p>
                          </div>
                          <div className="in-actions">
                            <div>
                              <button type="button" className="in-btn is-primary" disabled={busy !== null} onClick={() => act(c.fingerprint, "done")}>
                                Done
                              </button>
                              <button type="button" className="in-btn" disabled={busy !== null} onClick={() => act(c.fingerprint, "not_useful")}>
                                Not useful
                              </button>
                              <button type="button" className="in-btn" disabled={busy !== null} onClick={() => act(c.fingerprint, "snoozed")}>
                                Remind me later
                              </button>
                            </div>
                            <span className="in-age">over the last {c.window_days} days</span>
                          </div>
                        </article>
                      );
                    })}
                  </section>
                )}

                {p.more.length > 0 && (
                  <button type="button" className="in-btn" onClick={() => setShowMore((m) => !m)}>
                    {showMore ? "Show fewer" : `Show ${p.more.length} more`}
                  </button>
                )}

                {visibleCards.length === 0 && (
                  <section className="in-empties">
                    {p.reason === "no_audience" ? (
                      <article className="in-empty">
                        <h3>Nothing for your role yet</h3>
                        <p>Insights are shared by role. Ask an administrator if you should be seeing some.</p>
                      </article>
                    ) : p.not_enough_data ? (
                      <article className="in-empty">
                        <h3>Not enough trading yet</h3>
                        <p>
                          There {p.orders_in_window === 1 ? "has been 1 order" : `have been ${p.orders_in_window ?? 0} orders`} in
                          the last {p.window_days} days. Insights wait until there are at least {p.min_orders_to_trust}, so a
                          quiet fortnight is not mistaken for a pattern.
                        </p>
                        {central && <p className="in-sub">You can lower that number in Settings, but the cards get less reliable as you do.</p>}
                      </article>
                    ) : (
                      <article className="in-empty">
                        <h3>Nothing stood out</h3>
                        <p>
                          {p.orders_in_window != null ? `${p.orders_in_window.toLocaleString("en-GB")} orders looked at, and nothing` : "Nothing"}{" "}
                          crossed a threshold. That is a good sign, not a fault.
                        </p>
                        {p.counts.hidden > 0 && (
                          <p className="in-sub">
                            {p.counts.hidden} {p.counts.hidden === 1 ? "card is" : "cards are"} hidden because somebody marked
                            {p.counts.hidden === 1 ? " it" : " them"} done or asked to be reminded later.
                          </p>
                        )}
                      </article>
                    )}
                  </section>
                )}

                {p.waiting_on.length > 0 && (
                  <section className="in-section" aria-labelledby="in-waiting">
                    <h2 id="in-waiting" className="rg-h2">Not available yet</h2>
                    <p className="in-sub">
                      These insights exist and are switched on. They stay quiet until the data reaches them, and the page says
                      so rather than showing an empty card.
                    </p>
                    <div className="rg-row">
                      {p.waiting_on.map((w) => (
                        <article key={w.source} className="in-card is-dashed">
                          <div className="in-labels is-between">
                            <h3>{w.label}</h3>
                            <span className="in-pill">{STATE_LABEL[w.state] ?? w.state}</span>
                          </div>
                          <p className="in-detail">{w.note}</p>
                          <div className="in-sub">
                            <strong>{w.insights_waiting.length} waiting:</strong> {w.insights_waiting.join(", ")}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </>
            );
          }}
        </Body>
      )}

      {tab === "insights" && central && (
        <section className="in-section" aria-labelledby="in-taken">
          <h2 id="in-taken" className="rg-h2">What the team does with these</h2>
          <p className="in-sub">
            Every Done, Not useful and Remind me later is kept, so you can see which kinds of advice get acted on and which
            keep getting dismissed. A rule nobody ever uses is worth turning off or rewording.
          </p>
          <Body res={taken} isEmpty={(d) => d.items.length === 0} empty="Nobody has acted on an insight yet.">
            {(d) => (
              <Table
                head={["Insight", "Done", "Not useful", "Later", "Acted on"]}
                right={[1, 2, 3, 4]}
                rows={d.items.map((i) => [
                  i.rule_title,
                  i.done,
                  i.not_useful,
                  i.snoozed,
                  i.acted_on_share == null ? "—" : `${Math.round(i.acted_on_share * 100)}%`,
                ])}
              />
            )}
          </Body>
        </section>
      )}

      {tab === "insights" && !page.data && !page.failed && <Empty>{""}</Empty>}
    </>
  );
}
