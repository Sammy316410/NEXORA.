// Which gateway NEXORA uses is pure configuration:
//
//   PAYMENT_PROVIDER=sandbox              built-in sandbox gateway (default, no keys)
//   PAYMENT_PROVIDER=paystack             Paystack, using PAYSTACK_SECRET_KEY
//     sk_test_...                         Paystack test mode (sandbox)
//     sk_live_... + PAYMENTS_ALLOW_LIVE   real money; blocked unless explicitly allowed
//
// The mode (test/live) always comes from the key itself, never from a flag, so
// a test key can never take real money and a live key is refused by default.

export type ProviderId = "sandbox" | "paystack";

export interface PaymentsConfig {
  providerId: ProviderId;
  label: string;
  mode: "test" | "live";
  currency: string;
  appUrl: string;
  webhookUrl: string;
  /** Set when the configuration can't take payments; the UI shows it and checkout is refused. */
  problem: string | null;
  /** Non-blocking note, e.g. an unknown provider name fell back to the sandbox. */
  note: string | null;
}

export function paymentsConfig(): PaymentsConfig {
  const requested = (process.env.PAYMENT_PROVIDER?.trim().toLowerCase() || "sandbox") as string;
  const currency = (process.env.PAYMENT_CURRENCY?.trim().toUpperCase() || "NGN").slice(0, 3);
  const appUrl = (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");

  if (requested === "paystack") {
    const key = process.env.PAYSTACK_SECRET_KEY?.trim() ?? "";
    const mode = key.startsWith("sk_live_") ? "live" : "test";
    let problem: string | null = null;
    if (!key) problem = "PAYSTACK_SECRET_KEY is not set.";
    else if (!/^sk_(test|live)_/.test(key)) problem = "PAYSTACK_SECRET_KEY should start with sk_test_ or sk_live_.";
    else if (mode === "live" && process.env.PAYMENTS_ALLOW_LIVE !== "true") {
      problem = "A live Paystack key is set but live payments are blocked. Set PAYMENTS_ALLOW_LIVE=true to take real money.";
    }
    return {
      providerId: "paystack",
      label: "Paystack",
      mode,
      currency,
      appUrl,
      webhookUrl: `${appUrl}/api/payments/webhook/paystack`,
      problem,
      note: null,
    };
  }

  return {
    providerId: "sandbox",
    label: "NEXORA Sandbox",
    mode: "test",
    currency,
    appUrl,
    webhookUrl: `${appUrl}/api/payments/webhook/sandbox`,
    problem: null,
    note: requested !== "sandbox" ? `Unknown PAYMENT_PROVIDER "${requested}". Using the built-in sandbox.` : null,
  };
}
