"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { AdminLoading } from "@/components/admin/admin-loading";

type Branch = { id: string; name: string };

type Enquiry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  reservation_type: string;
  occasion: string | null;
  notes: string | null;
  status: string;
  staff_message: string | null;
  branch_id: string;
  branch_name: string | null;
};

type StateFilter = "all" | "open" | "replied" | "done";

function statusOf(row: Enquiry): { key: "open" | "replied" | "done"; text: string; cls: string } {
  if (row.status !== "pending") return { key: "done", text: "Done", cls: "admin-status" };
  if (row.staff_message) return { key: "replied", text: "Replied", cls: "admin-status is-ok" };
  return { key: "open", text: "Open", cls: "admin-status is-wait" };
}

export default function AdminInboxPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const canManage = hasPermission(me, "manage_marketing");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [tenantEmail, setTenantEmail] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const [replyText, setReplyText] = useState("");
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  const load = useCallback(() => {
    apiFetch("/reservations")
      .then((rows: Enquiry[]) => setEnquiries(rows.filter((r) => r.reservation_type === "enquiry")))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiFetch("/branches").then(setBranches).catch(() => setBranches([]));
    // Only used for the "also sent to…" line and reply bcc — not every role
    // that can manage the inbox also has settings access, so this is best-effort.
    apiFetch("/settings/tenant")
      .then((t: { email: string | null }) => setTenantEmail(t.email))
      .catch(() => setTenantEmail(null));
  }, []);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) {
      router.replace("/admin/dashboard");
      return;
    }
    load();
  }, [meLoading, me, canManage, router, load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

  async function sendReply() {
    if (!editing || !replyText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated: Enquiry = await apiFetch(`/reservations/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: editing.status, staff_message: replyText.trim() }),
      });
      setEnquiries((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditing(updated);

      const subject = `Re: ${editing.occasion || "Sweet1NE"}`;
      const body = `${replyText.trim()}\n\n—\n${editing.notes ?? ""}`;
      const params = new URLSearchParams();
      if (tenantEmail) params.set("bcc", tenantEmail);
      params.set("subject", subject);
      params.set("body", body);
      window.location.href = `mailto:${encodeURIComponent(editing.email)}?${params.toString()}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that reply.");
    } finally {
      setSaving(false);
    }
  }

  async function markDone() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const updated: Enquiry = await apiFetch(`/reservations/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "confirmed" }),
      });
      setEnquiries((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark that done.");
    } finally {
      setSaving(false);
    }
  }

  if (meLoading || !me || !canManage) {
    return <AdminLoading />;
  }

  const branchScoped = enquiries.filter((r) => !branchFilter || r.branch_id === branchFilter);
  const visible = branchScoped.filter((r) => {
    if (stateFilter !== "all" && statusOf(r).key !== stateFilter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [r.name, r.occasion, r.notes, r.email].some((v) => (v ?? "").toLowerCase().includes(q));
  });

  const openCount = branchScoped.filter((r) => r.status === "pending").length;

  return (
    <>
      <div className="admin-top">
        <div className="admin-places" role="group" aria-label="Restaurant">
          <button
            type="button"
            className={branchFilter === "" ? "is-on" : undefined}
            onClick={() => setBranchFilter("")}
          >
            All branches
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={branchFilter === b.id ? "is-on" : undefined}
              onClick={() => setBranchFilter(branchFilter === b.id ? "" : b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Inbox</h1>
      <p className="admin-dek">{openCount} open</p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <section className="admin-board tight" aria-label="Inbox">
        <article className="admin-card">
          <h2>Contact</h2>
          <p className="admin-stat">{openCount}</p>
          <p>
            Enquiries from the website Contact form.
            {tenantEmail ? ` Also sent to ${tenantEmail}.` : ""} A marketing tick on Contact is a
            lead, not an enquiry.
          </p>
          {tenantEmail && (
            <div className="admin-acts">
              <a className="admin-act" href={`mailto:${tenantEmail}`}>
                {tenantEmail}
              </a>
            </div>
          )}
        </article>
      </section>

      <div className="admin-cats" role="group" aria-label="Status">
        <button
          type="button"
          className={stateFilter === "all" ? "is-on" : undefined}
          onClick={() => setStateFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={stateFilter === "open" ? "is-on" : undefined}
          onClick={() => setStateFilter("open")}
        >
          Open
        </button>
        <button
          type="button"
          className={stateFilter === "replied" ? "is-on" : undefined}
          onClick={() => setStateFilter("replied")}
        >
          Replied
        </button>
        <button
          type="button"
          className={stateFilter === "done" ? "is-on" : undefined}
          onClick={() => setStateFilter("done")}
        >
          Done
        </button>
      </div>
      <div className="admin-tools">
        <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {loading ? (
        <AdminLoading />
      ) : visible.length === 0 ? (
        <p className="admin-empty">No enquiries from Contact.</p>
      ) : (
        <div className="admin-data-panel">
          <table className="admin-sheet">
            <thead>
              <tr>
                <th>From</th>
                <th>Subject</th>
                <th>Restaurant</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const st = statusOf(row);
                return (
                  <tr key={row.id}>
                    <td>
                      <span className="admin-name">{row.name}</span>
                    </td>
                    <td>
                      <span>{row.occasion}</span>
                      <div className="admin-muted">{row.email}</div>
                    </td>
                    <td className="admin-muted">{row.branch_name ?? "—"}</td>
                    <td>
                      <span className={st.cls}>{st.text}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-edit"
                        aria-label="Open"
                        onClick={() => {
                          setEditing(row);
                          setReplyText("");
                        }}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor — portaled into the third grid column owned by the shared
          /admin layout, same as menu, events, tables, staff and roles. See
          #admin-drawer-slot in admin/layout.tsx. */}
      {editing &&
        drawerSlot &&
        createPortal(
          <aside className="admin-drawer-edit">
            <h2>{editing.occasion || "Enquiry"}</h2>
            <div className="mb-4 space-y-2 text-sm text-[var(--ivory)]">
              <p>
                <strong>{editing.name}</strong>{" "}
                <a href={`mailto:${editing.email}`}>{editing.email}</a>
                {editing.phone && (
                  <>
                    {" · "}
                    <a href={`tel:${editing.phone.replace(/\s/g, "")}`}>{editing.phone}</a>
                  </>
                )}
              </p>
              <p className="text-[var(--ivory-dim)]">
                {[editing.occasion, editing.branch_name].filter(Boolean).join(" · ")}
              </p>
              <p>{editing.notes}</p>
              {editing.staff_message && (
                <p>
                  <strong>Reply sent</strong> {editing.staff_message}
                </p>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendReply();
              }}
              className="admin-form"
            >
              <fieldset disabled={saving} className="contents">
                <label>
                  Reply
                  <textarea
                    required
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button type="submit" className="admin-book">
                    Send reply
                  </button>
                  <button type="button" className="admin-book" onClick={markDone}>
                    Mark done
                  </button>
                  <button type="button" className="admin-book" onClick={() => setEditing(null)}>
                    Close
                  </button>
                </div>
              </fieldset>
            </form>
          </aside>,
          drawerSlot
        )}
    </>
  );
}
