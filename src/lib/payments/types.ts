import type { PaymentStatus } from "../types";

// Every payment gateway plugs in behind this interface. NEXORA's own code
// (checkout, confirmation, the bill, the dashboard) never talks to a gateway
// directly, so going from the sandbox to Paystack test mode to Paystack live is
// configuration, not a rebuild. Adding Flutterwave later = one new adapter.

export interface InitializeInput {
  reference: string;
  amountMinor: number;
  currency: string;
  email: string;
  merchantName: string;
  description: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export interface InitializeResult {
  /** Where to send the guest to pay (the gateway's hosted checkout page). */
  checkoutUrl: string;
  providerReference: string | null;
}

export interface VerifyResult {
  status: PaymentStatus;
  amountMinor: number | null;
  currency: string | null;
  paidAt: string | null;
  channel: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  failureReason: string | null;
}

export interface WebhookEvent {
  event: string;
  reference: string;
}

export interface PaymentProvider {
  id: string;
  label: string;
  mode: "test" | "live";
  initialize(input: InitializeInput): Promise<InitializeResult>;
  /** Ask the gateway what really happened. The only source of truth for a payment. */
  verify(reference: string): Promise<VerifyResult>;
  /** Check the webhook signature. Returns null when the signature is missing or wrong. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null>;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public code: "config" | "provider" | "invalid" | "not_found" = "invalid",
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
