"use client";

import { use, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Sidebar } from "@/components/staff/sidebar";

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
      <div className="flex min-h-screen items-center justify-center bg-slate-bg">
        <p className="text-sm text-slate-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-bg">
      <Sidebar variant="branch" branchName={branch.name} basePath={`/${branchSlug}`} />
      <main className="flex-1 overflow-y-auto px-6 py-8 max-md:pt-20 md:px-10">{children}</main>
    </div>
  );
}