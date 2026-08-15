"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMe, hasPermission, type Me } from "@/lib/use-me";
import { NAV_GROUPS } from "./nav-items";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STORAGE_KEY = "sweet1ne_sidebar_collapsed";

type Variant = "admin" | "branch";

function SidebarBody({
  me,
  collapsed,
  onToggle,
  onNavigate,
  showToggle,
  hideHeader = false,
  variant = "admin",
  branchName,
  basePath,
}: {
  me: Me | null;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  showToggle: boolean;
  hideHeader?: boolean;
  variant?: Variant;
  branchName?: string;
  basePath: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isBranch = variant === "branch";

  const surface = isBranch ? "bg-navy" : "bg-ink-cool";
  const accentBar = isBranch ? "bg-emerald" : "bg-gold";
  const labelColour = isBranch ? "text-slate-label" : "text-paper/35";
  const dividerColour = isBranch ? "bg-white/[0.06]" : "bg-white/10";
  const borderColour = isBranch ? "border-white/[0.06]" : "border-white/10";
  const activeClasses = isBranch ? "bg-emerald/15 text-emerald" : "bg-white/5 text-paper";
  const inactiveClasses = isBranch
    ? "text-slate-muted hover:bg-white/5 hover:text-white"
    : "text-paper/60 hover:bg-white/5 hover:text-paper/90";
  const subLabelColour = isBranch ? "text-slate-label" : "text-paper/45";
  const footerName = isBranch ? "text-white/90" : "text-paper/90";
  const footerRole = isBranch ? "text-slate-muted" : "text-paper/45";
  const logoutClasses = isBranch
    ? "text-slate-muted hover:bg-white/5 hover:text-white"
    : "text-paper/60 hover:bg-white/5 hover:text-paper/90";
  const toggleClasses = isBranch
    ? "text-slate-muted hover:bg-white/5 hover:text-white"
    : "text-paper/60 hover:bg-white/5 hover:text-paper";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermission(me, item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className={`flex h-full flex-col ${surface} text-paper`}>
      {!hideHeader && (
        <div
          className={`flex items-center gap-2 px-4 pb-5 pt-6 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!collapsed && (
            <div>
              <span className="font-display text-xl tracking-tight">Sweet1NE</span>
              {branchName && (
                <p className={`mt-0.5 text-xs uppercase tracking-[0.14em] ${subLabelColour}`}>
                  {branchName}
                </p>
              )}
            </div>
          )}
          {showToggle && (
            <button
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`rounded p-1.5 ${toggleClasses}`}
            >
              <Menu size={18} />
            </button>
          )}
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4">
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.heading}>
            {collapsed ? (
              groupIndex > 0 && <div className={`mx-2 my-3 h-px ${dividerColour}`} />
            ) : (
              <p
                className={`px-3 pb-1 pt-4 text-[11px] uppercase tracking-[0.15em] ${labelColour}`}
              >
                {group.heading}
              </p>
            )}

            {group.items.map((item) => {
              const href = `${basePath}${item.href}`;
              const active = pathname.startsWith(href);
              const Icon = item.icon;

              const link = (
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={`relative flex items-center gap-3 rounded-r-sm py-2.5 text-sm transition-colors ${
                    collapsed ? "justify-center px-2" : "px-3"
                  } ${active ? activeClasses : inactiveClasses}`}
                >
                  {active && (
                    <span
                      className={`absolute inset-y-1 left-0 w-[3px] rounded-full ${accentBar}`}
                    />
                  )}
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );

              if (!collapsed) {
                return <div key={href}>{link}</div>;
              }

              return (
                <Tooltip key={href}>
                  <TooltipTrigger render={link} />
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={`border-t ${borderColour} px-3 py-4`}>
        {!collapsed && me && (
          <div className="mb-3 px-1">
            <p className={`truncate text-sm ${footerName}`}>{me.full_name ?? me.email}</p>
            <p className={`truncate text-xs ${footerRole}`}>{me.role_name}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`flex w-full items-center gap-3 rounded px-3 py-2 text-sm ${logoutClasses} ${
            collapsed ? "justify-center px-2" : ""
          }`}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </div>
  );
}

export function Sidebar({
  variant = "admin",
  branchName,
  basePath,
}: {
  variant?: Variant;
  branchName?: string;
  basePath: string;
}) {
  const { me } = useMe();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isBranch = variant === "branch";
  const surface = isBranch ? "bg-navy" : "bg-ink-cool";
  const subLabelColour = isBranch ? "text-slate-label" : "text-paper/45";
  const closeClasses = isBranch
    ? "text-slate-muted hover:bg-white/10 hover:text-white"
    : "text-paper/70 hover:bg-white/10 hover:text-paper";

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <TooltipProvider delay={200}>
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className={`fixed left-4 top-4 z-40 rounded-md ${surface} p-2.5 text-paper md:hidden`}
      >
        <Menu size={20} />
      </button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-0 p-0 [&>button]:hidden">
          <div className={`flex h-full flex-col ${surface}`}>
            <div className="flex items-start justify-between px-4 pb-2 pt-5">
              <div>
                <span className="font-display text-xl tracking-tight text-paper">Sweet1NE</span>
                {branchName && (
                  <p className={`mt-0.5 text-xs uppercase tracking-[0.14em] ${subLabelColour}`}>
                    {branchName}
                  </p>
                )}
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className={`rounded-md p-2.5 ${closeClasses}`}
              >
                <X size={24} />
              </button>
            </div>
            <SidebarBody
              me={me}
              collapsed={false}
              onToggle={() => {}}
              onNavigate={() => setMobileOpen(false)}
              showToggle={false}
              hideHeader
              variant={variant}
              branchName={branchName}
              basePath={basePath}
            />
          </div>
        </SheetContent>
      </Sheet>

      <aside
        className={`hidden h-screen shrink-0 transition-[width] duration-200 md:block ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <SidebarBody
          me={me}
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          showToggle
          variant={variant}
          branchName={branchName}
          basePath={basePath}
        />
      </aside>
    </TooltipProvider>
  );
}