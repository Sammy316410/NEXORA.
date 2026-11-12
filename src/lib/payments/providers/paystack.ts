import { createHmac, timingSafeEqual } from "node:crypto";
import type { InitializeInput, InitializeResult, PaymentProvider, VerifyResult, WebhookEvent } from "../types";
import { PaymentError } from "../types";
import type { PaymentStatus } from "../../types";

// Paystack adapter (Nigeria-first, NGN in kobo). Test or live mode is decided by
// the secret key (sk_test_ / sk_live_); config.ts blocks live keys by default.
//   Initialize: POST /transaction/initialize  -> data.authorization_url (hosted checkout)
//   Verify:     GET  /transaction/verify/:ref -> data.status, amount, authorization.last4...
//   Webhooks:   x-paystack-signature = hex HMAC-SHA512 of the raw body, keyed with the secret key

const API = "https://api.paystack.co";

// Paystack reports a checkout the customer hasn't finished as "abandoned", even
// while they are still on the page, so it is treated as not finished yet.
const STATUS: Record<string, PaymentStatus> = {
  success: "succeeded",
  failed: "failed",
  abandoned: "initialized",
  reversed: "refunded",
  ongoing: "pending",
  pending: "pending",
  processing: "pending",
  queued: "pending",
};

interface PaystackVerifyData {
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  paid_at?: string | null;
  channel?: string | null;
  gateway_response?: string | null;
  authorization?: { last4?: string | null; brand?: string | null; card_type?: string | null } | null;
}

export function paystackProvider(secretKey: string): PaymentProvider {
  const mode = secretKey.startsWith("sk_live_") ? "live" : "test";

  async function call<T>(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        method: init.method,
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new PaymentError(`Couldn't reach Paystack: ${err instanceof Error ? err.message : String(err)}`, "provider");
    }
    const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
    if (!res.ok || json.status === false || json.data === undefined) {
      throw new PaymentError(`Paystack: ${json.message ?? `HTTP ${res.status}`}`, "provider");
    }
    return json.data;
  }

  return {
    id: "paystack",
    label: "Paystack",
    mode,

    async initialize(input: InitializeInput): Promise<InitializeResult> {
      const data = await call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
        method: "POST",
        body: {
          email: input.email,
          amount: input.amountMinor,
          currency: input.currency,
          reference: input.reference,
          callback_url: input.callbackUrl,
          metadata: {
            ...input.metadata,
            custom_fields: [{ display_name: "For", variable_name: "description", value: input.description }],
          },
        },
      });
      return { checkoutUrl: data.authorization_url, providerReference: data.access_code };
    },

    async verify(reference: string): Promise<VerifyResult> {
      const data = await call<PaystackVerifyData>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
      const status = STATUS[data.status ?? ""] ?? "initialized";
      return {
        status,
        amountMinor: typeof data.amount === "number" ? data.amount : null,
        currency: data.currency ?? null,
        paidAt: data.paid_at ?? null,
        channel: data.channel ?? null,
        cardBrand: data.authorization?.brand ?? data.authorization?.card_type ?? null,
        cardLast4: data.authorization?.last4 ?? null,
        failureReason: status === "failed" || status === "abandoned" ? data.gateway_response ?? "Payment not completed" : null,
      };
    },

    async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null> {
      const given = headers.get("x-paystack-signature") ?? "";
      const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
      if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
      try {
        const body = JSON.parse(rawBody) as { event?: string; data?: { reference?: string } };
        return body.data?.reference ? { event: body.event ?? "unknown", reference: body.data.reference } : null;
      } catch {
        return null;
      }
    },
  };
}
