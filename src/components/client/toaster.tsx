"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Info, TriangleExclamationPoint, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

let nextId = 1;
const listeners = new Set<(t: ToastItem) => void>();

/** Show a toast from any client component. */
export function toast(message: string, tone: ToastTone = "info") {
  const item = { id: nextId++, message, tone };
  listeners.forEach((fn) => fn(item));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const add = (t: ToastItem) => {
      setItems((prev) => [...prev.slice(-3), t]);
      window.setTimeout(() => setItems((prev) => prev.filter((p) => p.id !== t.id)), t.tone === "error" ? 7000 : 4500);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
    >
      {items.map((t) => {
        const Icon = t.tone === "success" ? CircleCheck : t.tone === "error" ? TriangleExclamationPoint : Info;
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-float",
              t.tone === "error" ? "bg-alert text-white" : "bg-ink text-white",
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", t.tone === "success" && "text-[#5DD39E]")} aria-hidden="true" />
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              className="-mr-1 rounded-md p-0.5 text-white/60 hover:text-white"
              onClick={() => setItems((prev) => prev.filter((p) => p.id !== t.id))}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
