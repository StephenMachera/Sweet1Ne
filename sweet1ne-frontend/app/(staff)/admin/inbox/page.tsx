"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Mail, MailOpen, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { AdminLoading } from "@/components/admin/admin-loading";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DARK_DIALOG =
  "border border-[rgba(201,162,74,0.42)] bg-[#0c0c0c] text-[#e5e2e1] sm:max-w-sm";
const DIALOG_BOOK_BTN =
  "inline-block rounded-[3px] border border-[rgba(201,162,74,0.9)] bg-transparent px-[1.15rem] py-[0.7rem] text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#c9a24a] hover:bg-[#c9a24a] hover:text-[#0e0e0e]";
const DIALOG_GHOST_BTN =
  "inline-block rounded-[3px] border border-[rgba(229,226,225,0.25)] bg-transparent px-[1.15rem] py-[0.7rem] text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#e5e2e1] hover:bg-[rgba(229,226,225,0.08)]";

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
  is_read: boolean;
  staff_message: string | null;
  branch_id: string;
  branch_name: string | null;
  created_at: string;
};

// How often the inbox checks for anything new on its own, without staff
// having to remember to refresh.
const AUTO_REFRESH_MS = 3 * 60 * 1000;

type StateFilter = "all" | "unread" | "open" | "replied" | "done";

function receivedAt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const [confirmDelete, setConfirmDelete] = useState<Enquiry | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(() => {
    apiFetch("/reservations")
      .then((rows: Enquiry[]) =>
        setEnquiries(
          rows
            .filter((r) => r.reservation_type === "enquiry")
            // Newest first — the backend's own order is soonest-booking-first,
            // which means oldest-first for an enquiry (no real date of its
            // own), the opposite of what's useful here.
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
            ),
        ),
      )
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
    const id = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(id);
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
      setReplyText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that reply.");
    } finally {
      setSaving(false);
    }
  }

  async function setRead(row: Enquiry, isRead: boolean) {
    try {
      const updated: Enquiry = await apiFetch(`/reservations/${row.id}/read`, {
        method: "PATCH",
        body: JSON.stringify({ is_read: isRead }),
      });
      setEnquiries((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditing((prev) => (prev?.id === updated.id ? updated : prev));
    } catch {
      // Not worth surfacing an error banner for a read receipt — worst case
      // it's re-sent next time the row is opened.
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

  async function remove(row: Enquiry) {
    setConfirmDelete(null);
    setError(null);
    try {
      await apiFetch(`/reservations/${row.id}`, { method: "DELETE" });
      setEnquiries((prev) => prev.filter((r) => r.id !== row.id));
      setSelected((prev) => {
        if (!prev.has(row.id)) return prev;
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      if (editing?.id === row.id) setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that.");
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function removeSelected() {
    setConfirmBulkDelete(false);
    setError(null);
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const failed: string[] = [];

    for (const id of ids) {
      try {
        await apiFetch(`/reservations/${id}`, { method: "DELETE" });
      } catch {
        failed.push(id);
      }
    }

    const removedIds = new Set(ids.filter((id) => !failed.includes(id)));
    setEnquiries((prev) => prev.filter((r) => !removedIds.has(r.id)));
    if (editing && removedIds.has(editing.id)) setEditing(null);
    setSelected(new Set(failed));
    setBulkDeleting(false);
    if (failed.length > 0) {
      setError(`Removed ${removedIds.size} of ${ids.length} — ${failed.length} didn't go through.`);
    }
  }

  if (meLoading || !me || !canManage) {
    return <AdminLoading />;
  }

  const branchScoped = enquiries.filter((r) => !branchFilter || r.branch_id === branchFilter);
  const visible = branchScoped.filter((r) => {
    if (stateFilter === "unread") {
      if (r.is_read) return false;
    } else if (stateFilter !== "all" && statusOf(r).key !== stateFilter) {
      return false;
    }
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [r.name, r.occasion, r.notes, r.email].some((v) => (v ?? "").toLowerCase().includes(q));
  });

  const openCount = branchScoped.filter((r) => r.status === "pending").length;
  const unreadCount = branchScoped.filter((r) => !r.is_read).length;

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
      <p className="admin-dek">
        {unreadCount > 0 ? `${unreadCount} unread · ` : ""}
        {openCount} open
      </p>

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
          className={stateFilter === "unread" ? "is-on" : undefined}
          onClick={() => setStateFilter("unread")}
        >
          Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
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
        {selected.size > 0 && (
          <button
            type="button"
            className="admin-book"
            disabled={bulkDeleting}
            onClick={() => setConfirmBulkDelete(true)}
          >
            {bulkDeleting ? "Removing…" : `Remove ${selected.size} selected`}
          </button>
        )}
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
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={visible.length > 0 && visible.every((r) => selected.has(r.id))}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(visible.map((r) => r.id)) : new Set())
                    }
                  />
                </th>
                <th>From</th>
                <th>Subject</th>
                <th>Restaurant</th>
                <th>Received</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const st = statusOf(row);
                const unread = !row.is_read;
                const open = () => {
                  setEditing(row);
                  setReplyText("");
                  if (unread) setRead(row, true);
                };
                return (
                  <tr
                    key={row.id}
                    onClick={open}
                    style={{ cursor: "pointer" }}
                    className={unread ? "is-unread" : undefined}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.name}`}
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelected(row.id)}
                      />
                    </td>
                    <td>
                      <span className="admin-name" style={unread ? { fontWeight: 700 } : undefined}>
                        {unread && (
                          <span
                            aria-hidden
                            style={{
                              display: "inline-block",
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "#c9a24a",
                              marginRight: 7,
                            }}
                          />
                        )}
                        {row.name}
                      </span>
                    </td>
                    <td>
                      <span style={unread ? { fontWeight: 700 } : undefined}>{row.occasion}</span>
                      <div className="admin-muted">{row.email}</div>
                    </td>
                    <td className="admin-muted">{row.branch_name ?? "—"}</td>
                    <td className="admin-muted">{receivedAt(row.created_at)}</td>
                    <td>
                      <span className={st.cls}>{st.text}</span>
                    </td>
                    <td className="admin-row-acts">
                      <button
                        type="button"
                        className="admin-edit"
                        aria-label="Open"
                        onClick={(e) => {
                          e.stopPropagation();
                          open();
                        }}
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        type="button"
                        className="admin-edit"
                        aria-label={unread ? "Mark read" : "Mark unread"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRead(row, unread);
                        }}
                      >
                        {unread ? <MailOpen size={15} /> : <Mail size={15} />}
                      </button>
                      <button
                        type="button"
                        className="admin-edit"
                        aria-label="Remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(row);
                        }}
                      >
                        <Trash2 size={15} />
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
                {[editing.occasion, editing.branch_name, receivedAt(editing.created_at)]
                  .filter(Boolean)
                  .join(" · ")}
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
                  <button
                    type="button"
                    className="admin-book"
                    onClick={() => editing && setRead(editing, false)}
                  >
                    Mark unread
                  </button>
                  <button type="button" className="admin-book" onClick={() => setEditing(null)}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="admin-book"
                    onClick={() => setConfirmDelete(editing)}
                  >
                    Remove
                  </button>
                </div>
              </fieldset>
            </form>
          </aside>,
          drawerSlot
        )}

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className={DARK_DIALOG}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#e5e2e1]">Remove this?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#a8a4a2]">
            {confirmDelete?.name} — this removes it for good, not just marks it done. Use this for
            spam, not a real enquiry you just don&apos;t want to answer yet.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={DIALOG_GHOST_BTN} onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button type="button" className={DIALOG_BOOK_BTN} onClick={() => confirmDelete && remove(confirmDelete)}>
              Remove
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <DialogContent className={DARK_DIALOG}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#e5e2e1]">
              Remove {selected.size} {selected.size === 1 ? "enquiry" : "enquiries"}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#a8a4a2]">
            This removes them for good, not just marks them done. Use this for spam, not real
            enquiries you just don&apos;t want to answer yet.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={DIALOG_GHOST_BTN} onClick={() => setConfirmBulkDelete(false)}>
              Cancel
            </button>
            <button type="button" className={DIALOG_BOOK_BTN} onClick={removeSelected}>
              Remove
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
