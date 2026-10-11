"use client";

import { use, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Sidebar } from "@/components/staff/sidebar";
import { AdminLoading } from "@/components/admin/admin-loading";

type Branch = { id: string; name: string; slug: string };

const RESERVED_SLUGS = [
  "admin",
  "login",
  "signup",
  "set-password",
  "menu",
  "story",
  "events",
  "locations",
  "reservations",
  "contact",
  "privacy",
  "terms",
];


export default function BranchLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const pathname = usePathname();
  const router = useRouter();

  // The customer ordering page lives under this segment but is public —
  // no session, no sidebar, no branch lookup. It renders itself entirely.
  const isGuestRoute =
  pathname === `/${branchSlug}/order` || pathname.startsWith(`/${branchSlug}/order/`);

  const { me, loading: meLoading } = useMe();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isGuestRoute) return;
    if (RESERVED_SLUGS.includes(branchSlug)) {
      router.replace("/admin/dashboard");
      return;
    }
    apiFetch("/branches")
      .then((branches: Branch[]) => {
        const match = branches.find((b) => b.slug === branchSlug);
        if (match) setBranch(match);
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [isGuestRoute, branchSlug, router]);

  useEffect(() => {
    if (isGuestRoute || !me || !branch) return;
    if (me.branch_id !== null && me.branch_id !== branch.id) {
      router.replace(`/${me.branch_slug}/dashboard`);
    }
  }, [isGuestRoute, me, branch, router]);

  if (isGuestRoute) {
    return <>{children}</>;
  }

  if (meLoading || !checked || !branch) {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <AdminLoading />
      </div>
    );
  }

  // Same grid shell as /admin — a sticky rail + a scrolling stage, not the
  // old fixed-height flex container with its own internal scroll.
  return (
    <div className="admin-shell grid min-h-[100svh] grid-cols-1 bg-[var(--bg)] font-body text-[var(--ivory)] min-[961px]:grid-cols-[17rem_minmax(0,1fr)]">
      <Sidebar variant="branch" branchName={branch.name} basePath={`/${branchSlug}`} />
      <main className="min-w-0">
        <div className="admin-stage">{children}</div>
      </main>
      {/* Same portal target as /admin — pages editing something (tables,
          menu items, etc.) mount an .admin-drawer-edit here. */}
      <div id="admin-drawer-slot" />
    </div>
  );
}