import { getStoredConsent } from "@/components/site/cookie-consent";
import { getGuestId } from "@/lib/guest-id";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const SESSION_KEY = "sweet1ne_session_id";
const MAX_BATCH = 20;
const FLUSH_AFTER_MS = 2000;

export type TrackEvent = {
  type: "page_view" | "item_view" | "add_to_basket" | "search" | "cta_click";
  path?: string;
  menu_item_id?: string;
  search_text?: string;
  results_count?: number;
};

const queue: TrackEvent[] = [];
let qrToken: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function sessionId(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!qrToken || queue.length === 0) return;

  const token = qrToken;
  const batch = queue.splice(0, queue.length);
  const session = sessionId();
  const deviceId = getStoredConsent() === "accepted" ? getGuestId() : null;

  for (let i = 0; i < batch.length; i += MAX_BATCH) {
    fetch(`${API_URL}/public/menu/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        source: "qr_menu",
        qr_token: token,
        ...(session ? { session_id: session } : {}),
        ...(deviceId ? { device_id: deviceId } : {}),
        events: batch.slice(i, i + MAX_BATCH),
      }),
    }).catch(() => {});
  }
}

/** Queues one QR menu event. Events are sent together a couple of seconds
 * later (or when the guest leaves the page), so one request carries several. */
export function trackQrEvent(token: string, event: TrackEvent) {
  if (typeof window === "undefined" || !token) return;
  qrToken = token;

  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);
  }

  queue.push(event);
  if (queue.length >= MAX_BATCH) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_AFTER_MS);
}
