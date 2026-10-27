"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function CurtainShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const inner = innerRef.current;
    if (!root || !inner) return;

    const apply = () => {
      const h = inner.offsetHeight;
      root.style.setProperty("--ty-fh", `${h}px`);
      // footer taller than the window: skip the curtain so nothing gets cut off
      root.dataset.flat = h > window.innerHeight - 40 ? "true" : "false";
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(inner);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  return (
    <div ref={rootRef} className="ty-curtain" data-flat="false">
      <div className="ty-stage">{children}</div>
      <div className="ty-cfoot">
        <div ref={innerRef}>{footer}</div>
      </div>
    </div>
  );
}