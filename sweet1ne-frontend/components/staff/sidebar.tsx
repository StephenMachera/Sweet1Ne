"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission, type Me } from "@/lib/use-me";
import { NAV_GROUPS } from "./nav-items";
import { MobileHeader } from "./mobile-header";

type Variant = "admin" | "branch";

/** Re-checked on every nav change, so it drops as soon as the Inbox page
 * itself marks things read — not a poll, just piggybacking on navigation. */
function useUnreadInboxCount(me: Me | null): number | null {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!me || !hasPermission(me, "manage_reservations")) return;
    let cancelled = false;
    apiFetch("/reservations")
      .then((rows: { reservation_type: string; is_read: boolean }[]) => {
        if (cancelled) return;
        setCount(rows.filter((r) => r.reservation_type === "enquiry" && !r.is_read).length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me, pathname]);

  return count;
}

const ORDERS_POLL_MS = 30 * 1000;

/** Polls, unlike Inbox's nav-triggered refetch — staff watching the floor
 * care about a new order arriving while they're already sitting on a
 * page, not only after navigating elsewhere and back. */
function useUnreadOrdersCount(me: Me | null): number | null {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!me || !hasPermission(me, "view_orders")) return;
    let cancelled = false;
    function check() {
      apiFetch("/staff/orders?period=daily")
        .then((rows: { is_read: boolean }[]) => {
          if (cancelled) return;
          setCount(rows.filter((r) => !r.is_read).length);
        })
        .catch(() => {});
    }
    check();
    const id = setInterval(check, ORDERS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [me, pathname]);

  return count;
}

const LEADS_POLL_MS = 30 * 1000;

/** Polls, same reasoning as Orders — a new subscriber can sign up at any
 * moment (QR, website, contact form) while staff are already sitting on
 * another page. */
function useUnreadLeadsCount(me: Me | null): number | null {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!me || !hasPermission(me, "manage_marketing")) return;
    let cancelled = false;
    function check() {
      apiFetch("/newsletter/subscribers?subscribed_only=false")
        .then((rows: { is_read: boolean }[]) => {
          if (cancelled) return;
          setCount(rows.filter((r) => !r.is_read).length);
        })
        .catch(() => {});
    }
    check();
    const id = setInterval(check, LEADS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [me, pathname]);

  return count;
}

function NavBadge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} unread`}
      style={{
        marginLeft: "auto",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: 999,
        background: "#c9a24a",
        color: "#0e0e0e",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * The admin console's rail — same tokens as the public site, one element
 * that's a fixed sidebar on desktop and a sticky top bar + slide-down menu
 * on mobile, matching the shared admin.css / admin-nav.js reference.
 *
 * Used for both variants now — branch passes its own basePath/branchName,
 * admin leaves branchName unset.
 */
function AdminRail({ basePath, branchName }: { basePath: string; branchName?: string }) {
  const { me } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const unreadInboxCount = useUnreadInboxCount(me);
  const unreadOrdersCount = useUnreadOrdersCount(me);
  const unreadLeadsCount = useUnreadLeadsCount(me);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermission(me, item.permission)),
  })).filter((group) => group.items.length > 0);

  // The reference's pageLabel(): the active item's label, "Staff" if
  // nothing matches (there's no page-specific title source yet).
  const activeItem = visibleGroups
    .flatMap((group) => group.items)
    .find((item) => pathname.startsWith(`${basePath}${item.href}`));
  const pageLabel = activeItem?.label ?? "Staff";

  const close = useCallback(() => setOpen(false), []);

  // Escape closes the mobile menu — unconditional, matching bindRailMenu.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // The page can't scroll behind the open mobile menu.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className={`admin-rail${open ? " is-open" : ""}`}>
      <MobileHeader
        open={open}
        onToggle={() => setOpen((prev) => !prev)}
        pageLabel={pageLabel}
        brandHref={`${basePath}/dashboard`}
        branchName={branchName}
        onSignOut={handleSignOut}
      />

      <button
        type="button"
        className="admin-rail-veil"
        tabIndex={-1}
        aria-label="Close menu"
        onClick={close}
      />

      <nav id="admin-menu" aria-label="Admin">
        {visibleGroups.map((group) => (
          <div className="admin-rail-group" key={group.heading}>
            <p className="admin-rail-label">{group.heading}</p>
            {group.items.map((item) => {
              const href = `${basePath}${item.href}`;
              const active = pathname.startsWith(href);
              const Icon = item.icon;

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={close}
                >
                  <Icon size={17} strokeWidth={1.6} />
                  <span>{item.label}</span>
                  {item.href === "/inbox" && !!unreadInboxCount && (
                    <NavBadge count={unreadInboxCount} />
                  )}
                  {item.href === "/orders" && !!unreadOrdersCount && (
                    <NavBadge count={unreadOrdersCount} />
                  )}
                  {item.href === "/leads" && !!unreadLeadsCount && (
                    <NavBadge count={unreadLeadsCount} />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="admin-rail-foot">
        <button type="button" className="admin-rail-out text-left" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function Sidebar({
  branchName,
  basePath,
}: {
  variant?: Variant;
  branchName?: string;
  basePath: string;
}) {
  return <AdminRail basePath={basePath} branchName={branchName} />;
}