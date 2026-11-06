"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { realtimeClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/cn";
import { toast } from "./toaster";

type Audience = "dashboard" | "staff" | "guest";

interface Payload {
  kind?: string;
  code?: string;
  room?: string | null;
  title?: string;
  assigneeId?: string | null;
  departmentId?: string;
  message?: string | null;
  feedback?: string | null;
  amount?: string;
}

/**
 * Keeps a screen live: listens for the server's Realtime pings and refreshes the
 * page's server data; also polls every few seconds as a safety net.
 */
export function LiveRefresh({
  topic,
  audience,
  staffId,
  departmentId,
  intervalMs = 8000,
  showIndicator = true,
}: {
  topic: string;
  audience: Audience;
  staffId?: string;
  departmentId?: string | null;
  intervalMs?: number;
  showIndicator?: boolean;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => router.refresh(), 250);
    };

    const notify = (p: Payload) => {
      if (audience === "dashboard") {
        if (p.kind === "created") toast(`New request · Room ${p.room} · ${p.title}`, "info");
        if (p.kind === "feedback_down") toast(`Room ${p.room} says the request wasn't resolved`, "error");
        if (p.kind === "payment_succeeded") toast(`Payment received · Room ${p.room} · ${p.amount}`, "success");
        if (p.kind === "payment_failed") toast(`Payment failed · Room ${p.room} · ${p.amount}`, "info");
      } else if (audience === "staff") {
        if (p.kind === "assigned" && staffId && p.assigneeId === staffId) {
          toast(`New task · Room ${p.room} · ${p.title}`, "info");
          navigator.vibrate?.([120, 60, 120]);
        }
      } else if (audience === "guest" && p.message) {
        toast(p.message, p.kind === "completed" || p.kind === "payment_succeeded" || p.kind === "created" ? "success" : "info");
      }
    };

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);

    const client = realtimeClient();
    const channel = client
      ?.channel(topic)
      .on("broadcast", { event: "change" }, (msg) => {
        notify((msg.payload ?? {}) as Payload);
        refresh();
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      window.clearInterval(poll);
      if (timer.current) window.clearTimeout(timer.current);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [topic, audience, staffId, departmentId, intervalMs, router]);

  if (!showIndicator) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted" title={connected ? "Live updates on" : "Updating every few seconds"}>
      <span className={cn("size-2 rounded-full", connected ? "animate-pulse-soft bg-[#1FA35B]" : "bg-line-strong")} aria-hidden="true" />
      {connected ? "Live" : "Auto-refresh"}
    </span>
  );
}
