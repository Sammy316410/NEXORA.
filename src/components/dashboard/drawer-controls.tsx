"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import type { Priority } from "@/lib/types";
import { toast } from "@/components/client/toaster";

/** Close the drawer with Escape. */
export function DrawerEscape({ closeHref }: { closeHref: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);
  return null;
}

export function PrioritySelect({
  value,
  action,
}: {
  value: Priority;
  action: (priority: Priority) => Promise<ActionResult>;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <select
      aria-label="Priority"
      defaultValue={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as Priority;
        start(async () => {
          const r = await action(next);
          if (!r.ok) toast(r.error, "error");
          else toast(`Priority set to ${next}.`, "success");
          router.refresh();
        });
      }}
      className="h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-sm font-medium"
    >
      <option value="low">Low</option>
      <option value="normal">Normal</option>
      <option value="high">High</option>
      <option value="urgent">Urgent</option>
    </select>
  );
}
