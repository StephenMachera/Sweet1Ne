"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type PlayFn = () => void;

type StageValue = {
  gated: boolean;
  headerSolid: boolean;
  setHeaderSolid: (solid: boolean) => void;
  registerPlay: (fn: PlayFn | null) => void;
  openHouse: () => void;
  enter: () => void;
};

const StageContext = createContext<StageValue | null>(null);

export function useStage(): StageValue {
  const ctx = useContext(StageContext);
  if (!ctx) throw new Error("useStage must be used inside <StageProvider>");
  return ctx;
}

export function StageProvider({ children }: { children: ReactNode }) {
  const [gated, setGated] = useState(true);
  const [headerSolid, setHeaderSolid] = useState(false);
  const playRef = useRef<PlayFn | null>(null);

  const registerPlay = useCallback((fn: PlayFn | null) => {
    playRef.current = fn;
  }, []);

  const openHouse = useCallback(() => setGated(false), []);

  // Safari unlock: play() must run inside the same user gesture.
  const enter = useCallback(() => {
    playRef.current?.();
    setGated(false);
  }, []);

  // reduced motion skips the gate entirely
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setGated(false);
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-gated", gated);
    return () => document.body.classList.remove("is-gated");
  }, [gated]);

  // keyboard entry while gated
  useEffect(() => {
    if (!gated) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        enter();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [gated, enter]);

  return (
    <StageContext.Provider
      value={{ gated, headerSolid, setHeaderSolid, registerPlay, openHouse, enter }}
    >
      {children}
    </StageContext.Provider>
  );
}