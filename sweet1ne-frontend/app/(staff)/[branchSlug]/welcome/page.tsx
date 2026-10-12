"use client";

import { use } from "react";
import { useMe } from "@/lib/use-me";
import { AdminLoading } from "@/components/admin/admin-loading";

/** Where landingPath() sends someone whose role doesn't match any of its
   known permissions — never permission-gated itself, so it always
   actually renders instead of bouncing them somewhere else that also
   turns them away. */
export default function BranchWelcomePage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  use(params);
  const { me, loading } = useMe();

  if (loading || !me) {
    return <AdminLoading />;
  }

  return (
    <>
      <h1>Welcome</h1>
      <p className="admin-dek">
        You&apos;re signed in as {me.full_name || me.email}, but your role ({me.role_name})
        doesn&apos;t have a page of its own to open first.
      </p>
      <p className="admin-empty">
        Use the tabs on the left to get to what you do have access to. If nothing useful shows
        up there either, ask an admin to check your role&apos;s permissions on Roles &amp;
        Permissions.
      </p>
    </>
  );
}
