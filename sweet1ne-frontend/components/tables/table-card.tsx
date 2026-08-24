"use client";

import { Download, Pencil, QrCode, RefreshCw, Users } from "lucide-react";
import type { Table } from "./table-form";

export function TableCard({
  table,
  tone,
  branchName,
  busy,
  onEdit,
  onRegenerate,
  onToggleActive,
}: {
  table: Table;
  tone: "admin" | "branch";
  branchName?: string;
  busy: boolean;
  onEdit: () => void;
  onRegenerate: () => void;
  onToggleActive: () => void;
}) {
  const isBranch = tone === "branch";

  const card = isBranch
    ? "border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    : "border-ink/8 bg-white shadow-[0_1px_3px_rgba(20,24,28,0.04)]";
  const title = isBranch ? "text-navy" : "text-ink";
  const muted = isBranch ? "text-slate-muted" : "text-ink-muted";
  const chip = isBranch ? "bg-slate-bg text-slate-subtle" : "bg-ink/5 text-ink-muted";
  const activeChip = isBranch ? "bg-success-bg text-success" : "bg-sage-soft text-sage";
  const inactiveChip = isBranch ? "bg-danger-bg text-danger" : "bg-ember-soft text-ember";
  const actionHover = isBranch ? "hover:bg-slate-bg" : "hover:bg-ink/5";
  async function downloadQr() {
      if (!table.qr_code_url) return;
      try {
        const res = await fetch(table.qr_code_url);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `table-${table.number}-qr.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
      } catch {
        window.open(table.qr_code_url, "_blank");
      }
    }
  return (
    <div className={`overflow-hidden rounded-xl border ${card}`}>
      {/* QR */}
      <div className="flex h-44 items-center justify-center border-b border-black/[0.04] bg-[#FAFBFC] p-3">
        {table.qr_code_url ? (
          <img
            src={table.qr_code_url}
            alt={`QR code for table ${table.number}`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className={`flex flex-col items-center gap-2 ${muted}`}>
            <QrCode size={28} />
            <span className="text-xs">No QR code yet</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={`font-medium ${title}`}>Table {table.number}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {table.region && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${chip}`}>
                  {table.region}
                </span>
              )}
              {branchName && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${chip}`}>
                  {branchName}
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  table.is_active ? activeChip : inactiveChip
                }`}
              >
                {table.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <span className={`flex shrink-0 items-center gap-1 text-sm ${muted}`}>
            <Users size={14} />
            {table.seats}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-1">
          <button
            onClick={onEdit}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs ${muted} ${actionHover}`}
          >
            <Pencil size={14} />
            Edit
          </button>

          {table.qr_code_url && (
            <button
              onClick={downloadQr}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs ${muted} ${actionHover}`}
            >
              <Download size={14} />
              Download
            </button>
          )}
 
 
          <button
            onClick={onRegenerate}
            disabled={busy}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs ${muted} ${actionHover} disabled:opacity-50`}
          >
            <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
            {table.qr_code_url ? "Regenerate" : "Generate"}
          </button>

          <button
            onClick={onToggleActive}
            className={`ml-auto flex h-8 items-center rounded-lg px-2.5 text-xs ${
              table.is_active
                ? isBranch
                  ? "text-danger hover:bg-danger-bg"
                  : "text-ember hover:bg-ember-soft"
                : isBranch
                  ? "text-success hover:bg-success-bg"
                  : "text-sage hover:bg-sage-soft"
            }`}
          >
            {table.is_active ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}