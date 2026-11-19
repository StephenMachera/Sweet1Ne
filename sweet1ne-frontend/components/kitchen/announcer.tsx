"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

const SOUND_KEY = "sweet1ne_kitchen_sound";

// How long the attention tone is, so the spoken line starts after it.
const TONE_MS = 1900;
// If nobody reacts, the tone repeats (without the voice) this often, this many times.
const NAG_EVERY_MS = 10_000;
const NAG_TIMES = 3;

type Pending = { key: string; message: string; urgent: boolean };

/** One audio context for the whole tab. Browsers only let it run after a tap,
 *  and several of them (phones and tablets especially) suspend it again when
 *  the screen sleeps, the tab is hidden or a call comes in — so it is shared
 *  and its state is always read live, never assumed. */
let sharedCtx: AudioContext | null = null;
function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

/** A loud, hard-to-miss alert: three rising (new) or falling (needs attention)
 *  notes, played twice, through a compressor so it is loud without distorting. */
function playTone(ctx: AudioContext, urgent: boolean) {
  const master = ctx.createGain();
  master.gain.value = 1;
  const compressor = ctx.createDynamicsCompressor();
  master.connect(compressor);
  compressor.connect(ctx.destination);

  const notes = urgent ? [1100, 880, 660] : [660, 880, 1100];
  const t0 = ctx.currentTime + 0.05;
  [0, 0.95].forEach((offset) => {
    notes.forEach((freq, i) => {
      const start = t0 + offset + i * 0.28;
      for (const [type, level, mult] of [
        ["triangle", 0.9, 1],
        ["sine", 0.5, 2],
      ] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq * mult;
        osc.connect(gain);
        gain.connect(master);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(level, start + 0.02);
        gain.gain.setValueAtTime(level, start + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.26);
        osc.start(start);
        osc.stop(start + 0.27);
      }
    });
  });
}

function speak(message: string, volume = 1) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth) return;
  try {
    // Clears a queue some browsers leave stuck, and wakes a paused one.
    synth.cancel();
    synth.resume?.();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.95;
    utterance.volume = volume;
    utterance.lang = "en-GB";
    synth.speak(utterance);
  } catch {
    // Speech is the extra; the tone has already sounded.
  }
}

/**
 * Plays an alert tone and then speaks it, because speech alone gets lost under
 * extraction fans. It never fails silently:
 *  - `needsUnlock` is true whenever the browser is not letting audio play (it
 *    is true on first load, and again if the browser suspends audio later), so
 *    the screen can show a clear "sound is off" button.
 *  - anything announced while audio is blocked is kept and sounded the moment
 *    it is unblocked, not dropped.
 *  - a tone nobody reacts to repeats a few times; any tap or key stops it.
 * Muting is a deliberate choice and is left alone.
 */
export function useAnnouncer() {
  const [enabled, setEnabled] = useState(true);
  const [running, setRunning] = useState(false);

  // Refs let `announce` keep one identity for the page's life, so a page that
  // polls does not restart its timers every time the sound state changes.
  const enabledRef = useRef(true);
  const runningRef = useRef(false);
  const spoken = useRef<Set<string>>(new Set());
  const pending = useRef<Pending[]>([]);
  const nag = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopNag = useCallback(() => {
    if (nag.current) clearTimeout(nag.current);
    nag.current = null;
  }, []);

  const startNag = useCallback(() => {
    stopNag();
    let left = NAG_TIMES;
    const again = () => {
      const ctx = getContext();
      if (left <= 0 || !ctx || ctx.state !== "running" || !enabledRef.current) return;
      left -= 1;
      playTone(ctx, false);
      nag.current = setTimeout(again, NAG_EVERY_MS);
    };
    nag.current = setTimeout(again, NAG_EVERY_MS);
  }, [stopNag]);

  /** Sounds one alert now. Returns false if the browser would not play audio. */
  const play = useCallback(
    async (message: string, urgent: boolean): Promise<boolean> => {
      const ctx = getContext();
      if (!ctx) return false;
      if (ctx.state !== "running") {
        try {
          await ctx.resume();
        } catch {
          // handled by the state check below
        }
      }
      if (ctx.state !== "running") return false;
      playTone(ctx, urgent);
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
      voiceTimer.current = setTimeout(() => speak(message), TONE_MS);
      startNag();
      return true;
    },
    [startNag]
  );

  const announce = useCallback(
    (key: string, message: string, urgent = false) => {
      if (!enabledRef.current) return; // muted on purpose
      // Each announcement fires once — polling or a re-render must never
      // repeat something the kitchen has already heard.
      if (spoken.current.has(key)) return;
      spoken.current.add(key);

      if (!runningRef.current) {
        pending.current.push({ key, message, urgent });
        return;
      }
      play(message, urgent).then((ok) => {
        if (!ok) pending.current.push({ key, message, urgent });
      });
    },
    [play]
  );

  // Keep the state honest: read the real audio state, and try to wake it on
  // any tap, key press, or when the tab comes back into view.
  useEffect(() => {
    const stored = window.localStorage.getItem(SOUND_KEY) !== "off";
    enabledRef.current = stored;
    const ctx = getContext();

    const sync = () => {
      const now = ctx?.state === "running";
      runningRef.current = now;
      setRunning(now);
    };
    const tryResume = () => {
      if (ctx && ctx.state !== "running") ctx.resume().then(sync).catch(() => {});
    };
    const acknowledge = () => stopNag();

    const gestures = ["pointerdown", "keydown", "touchstart"] as const;
    gestures.forEach((name) => window.addEventListener(name, tryResume, { passive: true }));
    gestures.forEach((name) => window.addEventListener(name, acknowledge, { passive: true }));
    document.addEventListener("visibilitychange", tryResume);
    window.addEventListener("focus", tryResume);
    ctx?.addEventListener("statechange", sync);
    // Some browsers interrupt audio without saying so, so also look now and then.
    const watch = setInterval(sync, 2000);
    const first = setTimeout(() => {
      setEnabled(stored);
      sync();
    }, 0);

    return () => {
      clearTimeout(first);
      clearInterval(watch);
      stopNag();
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
      gestures.forEach((name) => window.removeEventListener(name, tryResume));
      gestures.forEach((name) => window.removeEventListener(name, acknowledge));
      document.removeEventListener("visibilitychange", tryResume);
      window.removeEventListener("focus", tryResume);
      ctx?.removeEventListener("statechange", sync);
    };
  }, [stopNag]);

  // The moment audio is allowed, sound whatever came in while it was blocked.
  useEffect(() => {
    if (!running || !enabledRef.current || pending.current.length === 0) return;
    const waiting = pending.current;
    pending.current = [];
    const message =
      waiting.length === 1
        ? waiting[0].message
        : `${waiting.length} alerts came in while the sound was off.`;
    const urgent = waiting.some((w) => w.urgent);
    play(message, urgent).then((ok) => {
      if (!ok) pending.current.push(...waiting);
    });
  }, [running, play]);

  const unlock = useCallback(async () => {
    // Needs a tap: creating and resuming the context inside the click is what
    // satisfies the browser's audio rule.
    const ctx = getContext();
    if (ctx) {
      try {
        await ctx.resume();
        // A silent blip — some browsers (iPad/iPhone) only truly unlock after
        // something has been played inside the tap.
        const silent = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = silent;
        source.connect(ctx.destination);
        source.start(0);
      } catch {
        // the state check below reports the result
      }
      runningRef.current = ctx.state === "running";
      setRunning(runningRef.current);
    }
    speak("", 0); // lets speech play later on browsers that need a tap first
    window.localStorage.setItem(SOUND_KEY, "on");
    enabledRef.current = true;
    setEnabled(true);
  }, []);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    if (!next) {
      window.speechSynthesis?.cancel();
      stopNag();
    }
  }, [stopNag]);

  /** For a "Test sound" button: plays exactly what a new order sounds like. */
  const test = useCallback(async () => {
    await unlock();
    await play("Sound check. This is what a new order sounds like.", false);
  }, [unlock, play]);

  return { announce, enabled, toggle, needsUnlock: !running, unlock, test };
}

/** The kitchen and bar screens' sound control. */
export function SoundControls({
  enabled,
  onToggle,
  needsUnlock,
  onUnlock,
  onTest,
}: {
  enabled: boolean;
  onToggle: () => void;
  needsUnlock: boolean;
  onUnlock: () => void;
  onTest?: () => void;
}) {
  if (needsUnlock) {
    return (
      <button
        onClick={onUnlock}
        className="flex animate-pulse items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white"
      >
        <VolumeX size={16} />
        Sound is OFF — tap to turn on
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {onTest && (
        <button
          onClick={onTest}
          className="rounded-lg border border-slate-border bg-white px-3 py-2 text-xs font-medium text-slate-muted"
        >
          Test sound
        </button>
      )}
      <button
        onClick={onToggle}
        aria-label={enabled ? "Mute announcements" : "Unmute announcements"}
        className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
          enabled
            ? "border-emerald/30 bg-emerald/10 text-emerald-dark"
            : "border-slate-border bg-white text-slate-muted"
        }`}
      >
        {enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
      </button>
    </div>
  );
}

/** The same control in the admin console's own button style (Orders pages). */
export function AdminSoundButton({
  enabled,
  onToggle,
  needsUnlock,
  onUnlock,
  onTest,
}: {
  enabled: boolean;
  onToggle: () => void;
  needsUnlock: boolean;
  onUnlock: () => void;
  onTest: () => void;
}) {
  if (needsUnlock) {
    return (
      <button
        type="button"
        className="admin-edit inline-flex animate-pulse items-center gap-1.5"
        onClick={onUnlock}
        aria-label="Sound is off. Turn on sound for new orders"
      >
        <VolumeX size={14} />
        Sound is OFF — tap to turn on
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="admin-edit inline-flex items-center gap-1.5" onClick={onTest}>
        Test sound
      </button>
      <button
        type="button"
        className="admin-edit inline-flex items-center gap-1.5"
        onClick={onToggle}
        aria-label={enabled ? "Mute new-order sound" : "Unmute new-order sound"}
      >
        {enabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
      </button>
    </span>
  );
}
