import { confirmPayment, providerById } from "@/lib/payments/service";

// Gateway webhooks, e.g. {APP_URL}/api/payments/webhook/paystack.
// 1. Check the signature over the raw body (unsigned or tampered = 401).
// 2. Ignore the payload's claims and ask the gateway (confirmPayment -> verify).
// 3. Answer 200 quickly; confirmation is idempotent, so retries are harmless.
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await params;
  let provider;
  try {
    provider = providerById(id);
  } catch {
    return Response.json({ ok: false, error: "Unknown provider" }, { status: 404 });
  }
  const raw = await request.text();
  const event = await provider.parseWebhook(raw, request.headers);
  if (!event) return Response.json({ ok: false, error: "Invalid signature" }, { status: 401 });

  const payment = await confirmPayment(event.reference);
  return Response.json({ ok: true, known: Boolean(payment), status: payment?.status ?? null });
}
