"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ChangeEvent = {
  table: "orders" | "order_items";
  eventType: "INSERT" | "UPDATE" | "DELETE";
  row: any;
  oldRow: any;
};

export type RealtimeStatus = "connecting" | "live" | "lost";

/** Returns the live connection status so a screen can say so when updates
 *  have stopped, instead of looking fine while showing stale orders. */
export function useStationRealtime(onChange: (event: ChangeEvent) => void): RealtimeStatus {
  const handler = useRef(onChange);
  handler.current = onChange;
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    const supabase = createClient();
    let closed = false;

    const channel = supabase
      .channel("station-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) =>
          handler.current({
            table: "orders",
            eventType: payload.eventType as ChangeEvent["eventType"],
            row: payload.new,
            oldRow: payload.old,
          })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        (payload) =>
          handler.current({
            table: "order_items",
            eventType: payload.eventType as ChangeEvent["eventType"],
            row: payload.new,
            oldRow: payload.old,
          })
      )
      .subscribe((next) => {
        if (closed) return;
        if (next === "SUBSCRIBED") setStatus("live");
        else if (next === "CHANNEL_ERROR" || next === "TIMED_OUT" || next === "CLOSED") setStatus("lost");
      });

    return () => {
      closed = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return status;
}