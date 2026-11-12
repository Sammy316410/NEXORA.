"use server";

import { sandboxCancel, sandboxPayWithCard, sandboxPayWithTransfer } from "@/lib/payments/sandbox-gateway";

// Actions behind the sandbox gateway's checkout page. In production this page is
// Paystack's own hosted checkout; these never run with a real provider.
//
// They return where to send the browser instead of calling redirect(): a real
// gateway hands the guest back to the hotel with a full page load, and the
// checkout component does the same (see sandbox-checkout.tsx).

type GatewayResult = { redirectTo: string } | { error: string };

export async function sandboxCardAction(reference: string, _prev: GatewayResult | null, formData: FormData): Promise<GatewayResult> {
  const result = await sandboxPayWithCard(reference, String(formData.get("card") ?? ""));
  return result.ok ? { redirectTo: result.redirectTo } : { error: result.error };
}

export async function sandboxTransferAction(reference: string): Promise<GatewayResult> {
  const result = await sandboxPayWithTransfer(reference);
  return result.ok ? { redirectTo: result.redirectTo } : { error: result.error };
}

export async function sandboxCancelAction(reference: string): Promise<GatewayResult> {
  const result = await sandboxCancel(reference);
  return result.ok ? { redirectTo: result.redirectTo } : { error: result.error };
}
