/** Replaces the bare "Loading…" text across the admin console — the
   brand mark breathes while a gold rule fills itself underneath, looping
   until the real content is ready. */
export function AdminLoading() {
  return (
    <div className="admin-loading" role="status" aria-label="Loading">
      <img src="/images/brand/logo.png" alt="" className="admin-loading-logo" />
      <span className="admin-loading-bar">
        <span />
      </span>
    </div>
  );
}
