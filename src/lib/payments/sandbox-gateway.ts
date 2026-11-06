// The sandbox gateway's "bank side": what happens when someone pays on the
// sandbox checkout page. It only accepts the published sandbox test cards, so a
// real card number can never be typed into it and stored.
import { after } from "next/server";
import { db } from "../db";
import { confirmPayment } from "./service";

export const SANDBOX_CARDS = [
  { number: "4084084084084081", brand: "visa", outcome: "success", label: "Visa, approved" },
  { number: "5399838383838381", brand: "mastercard", outcome: "success", label: "Mastercard, approved" },
  { number: "4000000000000002", brand: "visa", outcome: "Declined by the card issuer", label: "Visa, declined" },
  { number: "4000000000009995", brand: "visa", outcome: "Insufficient funds", label: "Visa, insufficient funds" },
] as const;

/** Bank transfers confirm a few seconds later, the way real transfers do. */
export const TRANSFER_CONFIRM_MS = 6000;

export interface SandboxTransaction {
  reference: string;
  merchant: string;
  description: string;
  email: string;
  amount_minor: number;
  currency: string;
  callback_url: string;
  status: "initialized" | "pending" | "success" | "failed" | "abandoned";
  gateway_response: string | null;
}

export async function getSandboxTransaction(reference: string): Promise<SandboxTransaction | null> {
  const { data } = await db().from("sandbox_transactions").select("*").eq("reference", reference).maybeSingle();
  return (data as SandboxTransaction | null) ?? null;
}

function returnUrl(tx: SandboxTransaction) {
  const sep = tx.callback_url.includes("?") ? "&" : "?";
  return `${tx.callback_url}${sep}reference=${encodeURIComponent(tx.reference)}`;
}

function later(task: () => Promise<void>) {
  const run = () => task().catch((err) => console.error("[sandbox] background task failed", err));
  try {
    after(run);
  } catch {
    void run();
  }
}

export type SandboxOutcome = { ok: true; redirectTo: string } | { ok: false; error: string };

export async function sandboxPayWithCard(reference: string, cardNumber: string): Promise<SandboxOutcome> {
  const digits = cardNumber.replace(/\D/g, "");
  const card = SANDBOX_CARDS.find((c) => c.number === digits);
  if (!card) return { ok: false, error: "Use one of the sandbox test cards listed below. Never enter a real card here." };
  const tx = await getSandboxTransaction(reference);
  if (!tx) return { ok: false, error: "This payment link isn't valid." };
  if (tx.status !== "initialized") return { ok: true, redirectTo: returnUrl(tx) };

  const success = card.outcome === "success";
  await db()
    .from("sandbox_transactions")
    .update({
      status: success ? "success" : "failed",
      channel: "card",
      card_brand: card.brand,
      card_last4: digits.slice(-4),
      gateway_response: success ? "Approved" : card.outcome,
      paid_at: success ? new Date().toISOString() : null,
    })
    .eq("reference", reference)
    .eq("status", "initialized");

  await confirmPayment(reference); // the merchant is told at once, like a webhook
  return { ok: true, redirectTo: returnUrl(tx) };
}

export async function sandboxPayWithTransfer(reference: string): Promise<SandboxOutcome> {
  const tx = await getSandboxTransaction(reference);
  if (!tx) return { ok: false, error: "This payment link isn't valid." };
  if (tx.status !== "initialized") return { ok: true, redirectTo: returnUrl(tx) };
  await db()
    .from("sandbox_transactions")
    .update({ status: "pending", channel: "bank_transfer", gateway_response: "Awaiting transfer" })
    .eq("reference", reference)
    .eq("status", "initialized");
  await confirmPayment(reference); // merchant sees "pending"
  later(async () => {
    await new Promise((r) => setTimeout(r, TRANSFER_CONFIRM_MS));
    await completeSandboxTransfer(reference);
  });
  return { ok: true, redirectTo: returnUrl(tx) };
}

/** The "bank" confirms the transfer. Exported so tests don't have to wait. */
export async function completeSandboxTransfer(reference: string): Promise<void> {
  await db()
    .from("sandbox_transactions")
    .update({ status: "success", gateway_response: "Transfer received", paid_at: new Date().toISOString() })
    .eq("reference", reference)
    .eq("status", "pending");
  await confirmPayment(reference);
}

export async function sandboxCancel(reference: string): Promise<SandboxOutcome> {
  const tx = await getSandboxTransaction(reference);
  if (!tx) return { ok: false, error: "This payment link isn't valid." };
  await db()
    .from("sandbox_transactions")
    .update({ status: "abandoned", gateway_response: "Cancelled by the customer" })
    .eq("reference", reference)
    .eq("status", "initialized");
  await confirmPayment(reference);
  return { ok: true, redirectTo: returnUrl(tx) };
}
