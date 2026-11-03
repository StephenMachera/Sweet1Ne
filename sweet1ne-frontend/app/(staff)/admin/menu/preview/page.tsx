"use client";

import { useCallback, useEffect, useState } from "react";
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
    <>
      <h1>The menu</h1>
      <p className="admin-dek">
        {scope.sharedOnly
          ? "Items shared across every branch."
          : branchName
            ? `What guests at ${branchName} see on the table.`
            : "What guests see on the table."}
      </p>

      <div className="mb-6">
        <BranchScopePicker branches={branches} scope={scope} onChange={setScope} />
      </div>

      <MenuBrowser key={scopeQuery} mode="preview" fetcher={fetcher} />
    </>
  );
}
