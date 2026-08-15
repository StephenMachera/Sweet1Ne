"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Sidebar } from "@/components/staff/sidebar";

type Branch = { id: string; name: string; slug: string };

export default function BranchLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [checked, setChecked] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/branches")
      .then((branches: Branch[]) => {
        const match = branches.find((b) => b.slug === branchSlug);
        if (!match) {
          setNotFound(true);
          return;
        }
        setBranch(match);
      })
      .catch((e) => {
        // Don't sign anyone out over a transient failure.
        setError(e instanceof Error ? e.message : "Couldn't load this branch.");
      })
      .finally(() => setChecked(true));
  }, [branchSlug]);

  useEffect(() => {
    if (!me || !branch) return;
    if (me.branch_id !== null && me.branch_id !== branch.id) {
      router.replace(`/${me.branch_slug}/dashboard`);
    }
  }, [me, branch, router]);

  if (meLoading || !checked || !branch) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-paper">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-bg">
      <Sidebar variant="branch" branchName={branch.name} basePath={`/${branchSlug}`} />
      <main className="flex-1 px-6 py-8 max-md:pt-20 md:px-10">{children}</main>
    </div>
  );
}