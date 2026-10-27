"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function ConversionTracker({ source }: { source: string }) {
  useEffect(() => {
    // fire once per browser session so a refresh doesn't double count
    try {
      if (sessionStorage.getItem("sw1_reservation_conv")) return;
      sessionStorage.setItem("sw1_reservation_conv", "1");
    } catch {
      /* storage blocked: still fire */
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "reservation_completed", reservation_source: source });
  }, [source]);

  return null;
}