"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui";
import { toast } from "./toaster";

/** A button that runs a (bound) server action and reports the result as a toast. */
export function ActionButton({
  action,
  children,
  variant = "primary",
  size = "md",
  className,
  confirmText,
  pendingText,
  successToast = true,
}: {
  action: () => Promise<ActionResult | void>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  confirmText?: string;
  pendingText?: string;
  successToast?: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass(variant, size, className)}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        start(async () => {
          const result = await action();
          if (result && !result.ok) toast(result.error, "error");
          else if (successToast && result && result.ok && result.message) toast(result.message, "success");
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
