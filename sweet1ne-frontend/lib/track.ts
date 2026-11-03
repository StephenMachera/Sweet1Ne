import { getStoredConsent } from "@/components/site/cookie-consent";
import { getGuestId } from "@/lib/guest-id";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const SESSION_KEY = "sweet1ne_session_id";
const MAX_BATCH = 20;
const FLUSH_AFTER_MS = 2000;

export type TrackEvent = {
  type: "page_view" | "item_view" | "add_to_basket" | "search" | "cta_click";
  path?: string;
  referrer?: string;
  menu_item_id?: string;
  search_text?: string;
  results_count?: number;
};

type Source = "website" | "qr_menu";

const queues: Record<Source, TrackEvent[]> = { website: [], qr_menu: [] };
let qrToken: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
let blocked = false;

function sessionId(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function send(source: Source, events: TrackEvent[]) {
  const deviceId = getStoredConsent() === "accepted" ? getGuestId() : null;
  const session = source === "qr_menu" ? sessionId() : null;

  for (let i = 0; i < events.length; i += MAX_BATCH) {
    fetch(`${API_URL}/public/menu/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        source,
        ...(source === "qr_menu" ? { qr_token: qrToken } : {}),
        ...(session ? { session_id: session } : {}),
        ...(deviceId ? { device_id: deviceId } : {}),
        events: events.slice(i, i + MAX_BATCH),
      }),
    }).catch(() => {});
  }
}

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (blocked) {
    queues.website.length = 0;
    queues.qr_menu.length = 0;
    return;
  }
  for (const source of ["website", "qr_menu"] as const) {
    const events = queues[source].splice(0, queues[source].length);
    if (events.length === 0) continue;
    if (source === "qr_menu" && !qrToken) continue;
    send(source, events);
  }
}

function enqueue(source: Source, event: TrackEvent) {
  if (typeof window === "undefined" || blocked) return;

  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);
  }

  queues[source].push(event);
  if (queues[source].length >= MAX_BATCH) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_AFTER_MS);
}

/** Stops all tracking for this page load, e.g. when a staff member is signed in. */
export function stopTracking() {
  blocked = true;
}

/** Queues a QR menu event. Events go out together a couple of seconds later,
 * or when the guest leaves the page, so one request carries several. */
export function trackQrEvent(token: string, event: TrackEvent) {
  if (!token) return;
  qrToken = token;
  enqueue("qr_menu", event);
}

/** Queues a public website event, batched the same way. */
export function trackWebsiteEvent(event: TrackEvent) {
  enqueue("website", event);
}
