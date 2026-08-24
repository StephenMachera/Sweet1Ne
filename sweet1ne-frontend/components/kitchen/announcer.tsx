"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

const SOUND_KEY = "sweet1ne_kitchen_sound";

/**
 * Speaks kitchen announcements and plays a chime first, because speech
 * alone gets lost under extraction fans. Browsers block audio until the
 * page has been interacted with, so this exposes an explicit enable step.
 */
export function useAnnouncer() {
  const [enabled, setEnabled] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(true);
  const audioContext = useRef<AudioContext | null>(null);
  const spoken = useRef<Set<string>>(new Set());

  useEffect(() => {
    setEnabled(window.localStorage.getItem(SOUND_KEY) !== "off");
  }, []);

  const unlock = useCallback(() => {
    // A user gesture is required before any audio will play. Creating the
    // context inside a click handler is what actually satisfies that.
    if (!audioContext.current) {
      audioContext.current = new AudioContext();
    }
    audioContext.current.resume();
    window.speechSynthesis?.cancel();
    setNeedsUnlock(false);
    // "Enable sound" should actually enable sound — not leave it muted if
    // an earlier session left the mute flag off in storage.
    window.localStorage.setItem(SOUND_KEY, "on");
    setEnabled(true);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      if (!next) window.speechSynthesis?.cancel();
      return next;
    });
  }, []);

  const chime = useCallback((urgent: boolean) => {
    const ctx = audioContext.current;
    if (!ctx) return;

    // Two quick tones — a rising pair for arrivals, a falling pair for
    // anything that needs attention rather than action.
    const notes = urgent ? [880, 660] : [660, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";

      const start = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

      osc.start(start);
      osc.stop(start + 0.16);
    });
  }, []);

  const announce = useCallback(
    (key: string, message: string, urgent = false) => {
      if (!enabled || needsUnlock) return;
      // Each announcement fires once — polling or a re-render must never
      // repeat something the kitchen has already heard.
      if (spoken.current.has(key)) return;
      spoken.current.add(key);

      chime(urgent);

      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.lang = "en-GB";
      setTimeout(() => window.speechSynthesis.speak(utterance), 420);
    },
    [enabled, needsUnlock, chime]
  );

  return { announce, enabled, toggle, needsUnlock, unlock };
}

export function SoundControls({
  enabled,
  onToggle,
  needsUnlock,
  onUnlock,
}: {
  enabled: boolean;
  onToggle: () => void;
  needsUnlock: boolean;
  onUnlock: () => void;
}) {
  if (needsUnlock) {
    return (
      <button
        onClick={onUnlock}
        className="flex items-center gap-2 rounded-lg bg-emerald px-3.5 py-2 text-sm font-medium text-white"
      >
        <Volume2 size={16} />
        Enable sound
      </button>
    );
  }

  return (
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
  );
}