"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { Textarea } from "@/components/ui";
import { toast } from "@/components/client/toaster";

export function FeedbackCard({
  rate,
}: {
  rate: (value: "up" | "down", note: string | null) => Promise<ActionResult>;
}) {
  const [mode, setMode] = useState<"ask" | "down">("ask");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const send = (value: "up" | "down") =>
    start(async () => {
      const result = await rate(value, value === "down" ? note || null : null);
      if (!result.ok) toast(result.error, "error");
      else if (result.message) toast(result.message, value === "up" ? "success" : "info");
      router.refresh();
    });

  if (mode === "down") {
    return (
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <p className="font-display text-[15px] font-bold">Sorry about that. What went wrong?</p>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. The towels were damp" className="min-h-20" />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => send("down")}
            className="flex-1 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Tell the duty manager
          </button>
          <button type="button" onClick={() => setMode("ask")} className="rounded-xl border border-line-strong px-4 py-3 text-sm font-medium">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="font-display text-[15px] font-bold">Was everything okay?</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => send("up")}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-line-strong text-[15px] font-semibold hover:bg-done-bg disabled:opacity-50"
        >
          <ThumbsUp className="size-5" aria-hidden="true" /> Yes
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setMode("down")}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-line-strong text-[15px] font-semibold hover:bg-alert-bg disabled:opacity-50"
        >
          <ThumbsDown className="size-5" aria-hidden="true" /> Not really
        </button>
      </div>
    </div>
  );
}
