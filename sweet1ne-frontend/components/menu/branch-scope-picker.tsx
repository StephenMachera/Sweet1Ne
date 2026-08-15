"use client";

export type Branch = { id: string; name: string; slug: string };
export type Scope = { branchId: string | null; sharedOnly: boolean };

export function BranchScopePicker({
  branches,
  scope,
  onChange,
}: {
  branches: Branch[];
  scope: Scope;
  onChange: (scope: Scope) => void;
}) {
  const isEverything = scope.branchId === null && !scope.sharedOnly;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-[0.14em] text-ink-muted">Showing</span>

      <button
        onClick={() => onChange({ branchId: null, sharedOnly: false })}
        className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
          isEverything
            ? "bg-ink text-paper"
            : "border border-ink/12 bg-white text-ink-muted hover:text-ink"
        }`}
      >
        Everything
      </button>

      <button
        onClick={() => onChange({ branchId: null, sharedOnly: true })}
        className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
          scope.sharedOnly
            ? "bg-ink text-paper"
            : "bg-gold-soft text-[#8a6a28] hover:brightness-95"
        }`}
      >
        Shared only
      </button>

      {branches.map((branch) => {
        const active = scope.branchId === branch.id;
        return (
          <button
            key={branch.id}
            onClick={() => onChange({ branchId: active ? null : branch.id, sharedOnly: false })}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              active
                ? "bg-ink text-paper"
                : "border border-ink/12 bg-white text-ink-muted hover:text-ink"
            }`}
          >
            {branch.name}
          </button>
        );
      })}
    </div>
  );
}