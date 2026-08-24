"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type ChangeEvent = {
  table: "orders" | "order_items";
  eventType: "INSERT" | "UPDATE" | "DELETE";
  row: any;
  oldRow: any;
};

export function useStationRealtime(onChange: (event: ChangeEvent) => void) {
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    const supabase = createClient();

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
      .subscribe((status) => {
        console.log("REALTIME STATUS", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}