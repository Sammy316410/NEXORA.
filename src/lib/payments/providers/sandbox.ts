import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../../db";
import type { InitializeInput, InitializeResult, PaymentProvider, VerifyResult, WebhookEvent } from "../types";
import type { PaymentStatus } from "../../types";

// The built-in sandbox gateway. It behaves like a real hosted checkout: its own
// payment page (/pay/sandbox/<reference>), its own ledger (sandbox_transactions),
// signed webhooks and a verify call. No money moves and no real card is accepted.

export function sandboxSecret(): string {
  return process.env.SANDBOX_WEBHOOK_SECRET?.trim() || process.env.NEXORA_SESSION_SECRET || "nexora-sandbox";
}

export function signSandboxPayload(rawBody: string): string {
  return createHmac("sha512", sandboxSecret()).update(rawBody).digest("hex");
}

const STATUS: Record<string, PaymentStatus> = {
  initialized: "initialized",
  pending: "pending",
  success: "succeeded",
  failed: "failed",
  abandoned: "abandoned",
};

export function sandboxProvider(appUrl: string): PaymentProvider {
  return {
    id: "sandbox",
    label: "NEXORA Sandbox",
    mode: "test",

    async initialize(input: InitializeInput): Promise<InitializeResult> {
      const { error } = await db().from("sandbox_transactions").insert({
        reference: input.reference,
        merchant: input.merchantName,
        description: input.description,
        email: input.email,
        amount_minor: input.amountMinor,
        currency: input.currency,
        callback_url: input.callbackUrl,
        status: "initialized",
      });
      if (error) throw new Error(`Sandbox gateway rejected the payment: ${error.message}`);
      return { checkoutUrl: `${appUrl}/pay/sandbox/${encodeURIComponent(input.reference)}`, providerReference: `SBX-${input.reference}` };
    },

    async verify(reference: string): Promise<VerifyResult> {
      const { data } = await db().from("sandbox_transactions").select("*").eq("reference", reference).maybeSingle();
      if (!data) {
        return { status: "failed", amountMinor: null, currency: null, paidAt: null, channel: null, cardBrand: null, cardLast4: null, failureReason: "Unknown payment reference" };
      }
      const status = STATUS[data.status as string] ?? "initialized";
      return {
        status,
        amountMinor: data.amount_minor,
        currency: data.currency,
        paidAt: data.paid_at,
        channel: data.channel,
        cardBrand: data.card_brand,
        cardLast4: data.card_last4,
        failureReason: status === "failed" || status === "abandoned" ? data.gateway_response : null,
      };
    },

    async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null> {
      const given = headers.get("x-sandbox-signature") ?? "";
      const expected = signSandboxPayload(rawBody);
      if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
      try {
        const body = JSON.parse(rawBody) as { event?: string; data?: { reference?: string } };
        return body.data?.reference ? { event: body.event ?? "charge.update", reference: body.data.reference } : null;
      } catch {
        return null;
      }
    },
  };
}
