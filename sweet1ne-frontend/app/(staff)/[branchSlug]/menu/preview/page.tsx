"use client";

import { use, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { MenuBrowser } from "@/components/menu/menu-browser";

export default function MenuPreviewPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const fetcher = useCallback((path: string) => apiFetch(`/staff/menu${path}`), []);

  return (
    <div className="space-y-5">
      {/* Header — stacks on mobile, row from sm up */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-navy sm:text-3xl">Customer view</h1>
          <p className="mt-1 text-sm text-slate-subtle">
            What customers see when they scan a table's QR code.
          </p>
        </div>

        <Link
          href={`/${branchSlug}/menu/manage`}
          className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-border bg-white px-4 text-sm text-slate-subtle transition-colors hover:text-navy sm:h-9 sm:w-auto"
        >
          <ArrowLeft size={15} />
          Back to management
        </Link>
      </div>

      {/* Preview frame */}
      <div className="rounded-xl border border-dashed border-emerald/30 bg-emerald/[0.03] p-3 sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-xs text-emerald-dark">
          <Eye size={14} className="shrink-0" />
          <span className="uppercase tracking-[0.14em]">Preview — ordering disabled</span>
        </div>

        <MenuBrowser mode="preview" fetcher={fetcher} />
      </div>
    </div>
  );
}