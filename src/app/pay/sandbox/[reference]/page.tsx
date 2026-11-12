import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSandboxTransaction, SANDBOX_CARDS } from "@/lib/payments/sandbox-gateway";
import { fmtMinor } from "@/lib/format";
import { sandboxCancelAction, sandboxCardAction, sandboxTransferAction } from "@/app/actions/sandbox";
import { SandboxCheckout } from "@/components/payments/sandbox-checkout";

export const metadata: Metadata = { title: "Sandbox checkout" };

// The built-in sandbox gateway's hosted checkout page. Deliberately looks like a
// third-party gateway (its own colours), because in production this page is
// Paystack's. No real card is accepted and no money moves.
export default async function SandboxCheckoutPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const tx = await getSandboxTransaction(decodeURIComponent(reference));
  if (!tx) redirect("/guest");
  if (tx.status !== "initialized") {
    redirect(`${tx.callback_url}${tx.callback_url.includes("?") ? "&" : "?"}reference=${encodeURIComponent(tx.reference)}`);
  }
  const amount = fmtMinor(tx.amount_minor, tx.currency);

  return (
    <div className="flex min-h-dvh items-start justify-center bg-[#EEF2F1] px-4 py-8 sm:items-center">
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between bg-[#F59E0B] px-6 py-1.5 text-xs font-bold tracking-wide text-[#451A03] uppercase">
          <span>Sandbox · test mode</span>
          <span>No real money</span>
        </div>
        <header className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-6 py-5">
          <div>
            <p className="text-sm text-[#6B7280]">{tx.merchant}</p>
            <p className="mt-0.5 text-sm text-[#111827]">{tx.description}</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">{tx.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#6B7280]">Pay</p>
            <p className="text-2xl font-bold text-[#111827] tabular-nums">{amount}</p>
          </div>
        </header>
        <SandboxCheckout
          amount={amount}
          cards={SANDBOX_CARDS}
          cardAction={sandboxCardAction.bind(null, tx.reference)}
          transferAction={sandboxTransferAction.bind(null, tx.reference)}
          cancelAction={sandboxCancelAction.bind(null, tx.reference)}
        />
        <footer className="flex items-center justify-center gap-1.5 bg-[#F9FAFB] px-6 py-3 text-xs text-[#6B7280]">
          <ShieldCheck className="size-3.5" aria-hidden="true" /> Secured by NEXORA Sandbox Pay · Ref {tx.reference}
        </footer>
      </div>
    </div>
  );
}
