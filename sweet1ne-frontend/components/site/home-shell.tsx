"use client";

import { useEffect, useState } from "react";
import { Cinema } from "./cinema";
import { Gate } from "./gate";
import { House } from "./house";
import { Plates } from "./plates";
import { SiteFooter } from "./site-footer";

/**
 * Holds the gate state, which the cinema needs so its pause button can wait
 * until the page has opened.
 */
export function HomeShell() {
  const [gated, setGated] = useState(true);

  // Nothing scrolls while the gate is up.
  useEffect(() => {
    document.body.classList.toggle("is-gated", gated);
    if (gated) {
      document.body.style.height = "100svh";
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.classList.remove("is-gated");
      document.body.style.height = "";
      document.body.style.overflow = "";
    };
  }, [gated]);

  return (
    <>
      <Cinema gated={gated} />
      <House />
      <Plates />
      <SiteFooter />

      <Gate onOpen={() => setGated(false)} />
    </>
  );
}