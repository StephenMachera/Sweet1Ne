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
    <div className="admin-places" role="group" aria-label="Showing">
      <button
        type="button"
        className={isEverything ? "is-on" : undefined}
        onClick={() => onChange({ branchId: null, sharedOnly: false })}
      >
        Everything
      </button>

      <button
        type="button"
        className={scope.sharedOnly ? "is-on" : undefined}
        onClick={() => onChange({ branchId: null, sharedOnly: true })}
      >
        Shared only
      </button>

      {branches.map((branch) => {
        const active = scope.branchId === branch.id;
        return (
          <button
            key={branch.id}
            type="button"
            className={active ? "is-on" : undefined}
            onClick={() => onChange({ branchId: active ? null : branch.id, sharedOnly: false })}
          >
            {branch.name}
          </button>
        );
      })}
    </div>
  );
}