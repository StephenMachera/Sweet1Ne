"use client";

import {
  createContext,
  useCallback,
  useContext,
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
  // The "Enter Sweet1NE" splash is gone — the homepage renders straight
  // away. `gated` stays in the context (Cinema's pause button and
  // PromoCard both read it) but nothing sets it back to true any more.
  const [gated, setGated] = useState(false);
  const [headerSolid, setHeaderSolid] = useState(false);
  const playRef = useRef<PlayFn | null>(null);

  const registerPlay = useCallback((fn: PlayFn | null) => {
    playRef.current = fn;
  }, []);

  const openHouse = useCallback(() => setGated(false), []);

  const enter = useCallback(() => {
    playRef.current?.();
    setGated(false);
  }, []);

  return (
    <StageContext.Provider
      value={{ gated, headerSolid, setHeaderSolid, registerPlay, openHouse, enter }}
    >
      {children}
    </StageContext.Provider>
  );
}