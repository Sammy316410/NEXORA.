"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { buttonClass, Textarea } from "@/components/ui";
import { toast } from "@/components/client/toaster";
import { cn } from "@/lib/cn";

const REASONS = ["Needs parts", "Guest not in the room", "Wrong department", "Need help from a colleague"];

/** S4: complete with an optional note and a "needs follow-up" switch. */
export function CompleteWithNote({ action }: { action: (formData: FormData) => Promise<ActionResult> }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full py-2 text-sm font-medium text-muted">
        Add a note or flag a follow-up
      </button>
    );
  }
  return (
    <form
      className="space-y-3 rounded-2xl border border-line bg-surface p-4"
      action={(fd) =>
        start(async () => {
          const r = await action(fd);
          if (!r.ok) toast(r.error, "error");
          else toast(r.message ?? "Marked complete.", "success");
          router.refresh();
        })
      }
    >
      <Textarea name="note" maxLength={300} placeholder="e.g. Replaced the tap washer" className="min-h-20" />
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="followUp" className="size-5 accent-[var(--color-accent)]" />
        Needs follow-up (e.g. a part is on order)
      </label>
      <button type="submit" disabled={pending} className={buttonClass("accent", "lg", "w-full")}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Complete with note
      </button>
    </form>
  );
}

/** "Can't do it": hand the task back to the front desk with a reason. */
export function HandBack({ action }: { action: (formData: FormData) => Promise<ActionResult> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full py-2 text-sm font-medium text-alert">
        Can&apos;t do it?
      </button>
    );
  }
  return (
    <form
      className="space-y-3 rounded-2xl border border-alert/25 bg-surface p-4"
      action={(fd) =>
        start(async () => {
          const r = await action(fd);
          if (!r.ok) toast(r.error, "error");
          else {
            toast(r.message ?? "Sent back to the front desk.", "info");
            router.push("/staff");
          }
          router.refresh();
        })
      }
    >
      <p className="font-display font-bold">Why can&apos;t you do it?</p>
      <input type="hidden" name="reason" value={reason} />
      <div className="grid gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={cn("min-h-12 rounded-xl border px-3 text-left text-sm font-medium", reason === r ? "border-ink bg-ink text-white" : "border-line-strong")}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass("danger", "lg", "flex-1")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Hand it back
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "lg")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
