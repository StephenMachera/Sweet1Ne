"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { MenuBrowser } from "@/components/menu/menu-browser";
import { BranchScopePicker, type Branch, type Scope } from "@/components/menu/branch-scope-picker";

export default function AdminMenuPreviewPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [scope, setScope] = useState<Scope>({ branchId: null, sharedOnly: false });

  useEffect(() => {
    apiFetch("/branches")
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  const scopeQuery = scope.sharedOnly
    ? "?shared_only=true"
    : scope.branchId
      ? `?branch_id=${scope.branchId}`
      : "";

  const fetcher = useCallback(
    (path: string) => apiFetch(`/staff/menu${path}${scopeQuery}`),
    [scopeQuery]
  );

  const branchName = branches.find((b) => b.id === scope.branchId)?.name;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink sm:text-3xl">Customer view</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {scope.sharedOnly
              ? "Items shared across every branch."
              : branchName
                ? `What customers at ${branchName} see when they scan a table's QR code.`
                : "What customers see when they scan a table's QR code."}
          </p>
        </div>

        <Link
          href="/admin/menu/manage"
          className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-ink/12 bg-white px-4 text-sm text-ink-muted transition-colors hover:text-ink sm:h-9 sm:w-auto"
        >
          <ArrowLeft size={15} />
          Back to management
        </Link>
      </div>

      <BranchScopePicker branches={branches} scope={scope} onChange={setScope} />

      <div className="rounded-xl border border-dashed border-gold/40 bg-gold/[0.04] p-3 sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-xs text-[#8a6a28]">
          <Eye size={14} className="shrink-0" />
          <span className="uppercase tracking-[0.14em]">Preview — ordering disabled</span>
        </div>

        <MenuBrowser key={scopeQuery} mode="preview" fetcher={fetcher} />
      </div>
    </div>
  );
}