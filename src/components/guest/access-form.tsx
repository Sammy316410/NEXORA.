"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { FormError, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/client/submit-button";

export function AccessForm({ action }: { action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult> }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="lastName">Last name on your booking</Label>
        <Input id="lastName" name="lastName" autoComplete="family-name" autoCapitalize="words" required placeholder="e.g. Okafor" />
      </div>
      {state && !state.ok ? <FormError>{state.error}</FormError> : null}
      <SubmitButton variant="hotel" size="xl" className="w-full" pendingText="Checking…">
        Continue
      </SubmitButton>
      <p className="text-center text-[13px] text-muted">This keeps your requests private to your room.</p>
    </form>
  );
}
