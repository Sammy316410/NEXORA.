"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { FormError, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/client/submit-button";

export function LoginForm({
  action,
  next,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  next?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@hotel.com" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state && !state.ok ? <FormError>{state.error}</FormError> : null}
      <SubmitButton variant="secondary" size="lg" className="w-full" pendingText="Signing in…">
        Sign in with email
      </SubmitButton>
    </form>
  );
}
