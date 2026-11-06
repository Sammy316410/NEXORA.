import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { confirmPayment } from "@/lib/payments/service";

// Where the gateway sends the guest after checkout. Paystack appends
// ?trxref=...&reference=...; the sandbox appends ?reference=... We never trust
// these parameters: confirmPayment asks the gateway what really happened.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const reference = params.get("reference") ?? params.get("trxref");
  if (!reference) redirect("/guest");
  await confirmPayment(reference);
  redirect(`/guest/payments/${encodeURIComponent(reference)}`);
}
