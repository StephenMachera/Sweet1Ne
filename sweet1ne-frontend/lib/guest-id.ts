const KEY = "sweet1ne_guest_id";

/**
 * A random, anonymous id the browser keeps for itself — no login, no PII,
 * nothing tying it to a real identity. Lets promotion "quiet"/"regular"
 * targeting work for real without ever knowing who the guest actually is.
 * Returns null during SSR/build, where there's no localStorage.
 */
export function getGuestId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
