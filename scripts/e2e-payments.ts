// End-to-end check of payments against the local database. No dev server needed
// and no real money: the sandbox gateway runs in-process and Paystack's HTTP API
// is mocked.
//   npm run test:payments
// Resets the demo data at the end.
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { seedDemo } from "../src/lib/seed";
import { cancelRequest, chargeOrderToRoom, createRequest, getEvents, getRequest, listRequests } from "../src/lib/requests";
import { activeProvider, confirmPayment, getPayment, listPayments, startCheckout } from "../src/lib/payments/service";
import { completeSandboxTransfer, sandboxCancel, sandboxPayWithCard, sandboxPayWithTransfer } from "../src/lib/payments/sandbox-gateway";
import { computeFolio } from "../src/lib/payments/folio";
import { paymentsConfig } from "../src/lib/payments/config";
import { paystackProvider } from "../src/lib/payments/providers/paystack";
import { sandboxProvider, signSandboxPayload } from "../src/lib/payments/providers/sandbox";
import { PaymentError } from "../src/lib/payments/types";
import type { Actor } from "../src/lib/types";

const CARD_OK = "4084 0840 8408 4081";
const CARD_OK_MC = "5399 8383 8383 8381";
const CARD_DECLINED = "4000 0000 0000 0002";
const CARD_NO_FUNDS = "4000 0000 0000 9995";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}`, detail ?? "");
  }
}

async function expectThrows(label: string, fn: () => unknown, test: (err: unknown) => boolean) {
  try {
    await fn();
    check(label, false, "no error thrown");
  } catch (err) {
    check(label, test(err), err instanceof Error ? err.message : err);
  }
}

// Env switches for the "configuration only" checks. Restored afterwards.
const ENV_KEYS = ["PAYMENT_PROVIDER", "PAYSTACK_SECRET_KEY", "PAYMENTS_ALLOW_LIVE"] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const k of ENV_KEYS) {
    const v = k in values ? values[k] : undefined;
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}
function restoreEnv() {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
}

// Paystack's API, mocked. Anything else (Realtime pings) goes to the real fetch.
const realFetch = globalThis.fetch;
type PaystackCall = { url: string; method: string; auth: string | null; body: Record<string, unknown> | null };
let paystackCalls: PaystackCall[] = [];
let paystackReply: (call: PaystackCall) => unknown = () => ({ status: false, message: "no mock" });
function mockPaystack() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("https://api.paystack.co")) return realFetch(input, init);
    const headers = new Headers(init?.headers);
    const call: PaystackCall = {
      url,
      method: init?.method ?? "GET",
      auth: headers.get("authorization"),
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null,
    };
    paystackCalls.push(call);
    const reply = paystackReply(call) as { status?: boolean };
    return new Response(JSON.stringify(reply), { status: reply.status === false ? 400 : 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}
function unmockPaystack() {
  globalThis.fetch = realFetch;
}

async function main() {
  setEnv({ PAYMENT_PROVIDER: "sandbox" });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  await seedDemo(db, { password: process.env.DEMO_STAFF_PASSWORD || "nexora-demo-2026" });

  const { data: hotel } = await db.from("hotels").select("id, name").eq("slug", "amber-coast").single();
  const { data: room } = await db.from("rooms").select("id").eq("hotel_id", hotel!.id).eq("number", "204").single();
  const { data: stay } = await db.from("reservations").select("id, guest_id, booking_ref").eq("room_id", room!.id).eq("status", "checked_in").single();
  const guest: Actor = { type: "guest", id: stay!.guest_id, name: "David" };
  const appUrl = paymentsConfig().appUrl;

  const order = (items: [string, number][], payment: "pay_now" | "charge_to_room") =>
    createRequest({
      hotelId: hotel!.id,
      roomId: room!.id,
      reservationId: stay!.id,
      guestId: stay!.guest_id,
      serviceId: "food-order",
      items: items.map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
      payment,
      source: "guest_portal",
      actor: guest,
    });
  const checkout = (o: { id: string; amount_minor: number; title: string }) =>
    startCheckout({
      hotelId: hotel!.id,
      merchantName: hotel!.name,
      reservationId: stay!.id,
      requestId: o.id,
      purpose: "order",
      amountMinor: o.amount_minor,
      description: `Room 204 · ${o.title}`,
      email: "david.okafor@example.com",
    });
  const balance = async () => (await computeFolio(db, stay!.id))!.balanceMinor;
  const reservationRow = async () => (await db.from("reservations").select("balance, payment_status").eq("id", stay!.id).single()).data!;
  const balance0 = await balance();

  console.log("\nSandbox checkout: declined, then approved");
  const o1 = await order([["jollof-chicken", 1], ["chapman", 2]], "pay_now");
  check("pay-now order waits for payment", o1.status === "awaiting_payment" && o1.payment_status === "awaiting", `${o1.status}/${o1.payment_status}`);
  check("priced on the server: ₦8,500 + 2 × ₦2,500", o1.amount_minor === 1_350_000, o1.amount_minor);
  check("not on the kitchen clock yet (no due time)", o1.due_at === null, o1.due_at);
  check("order title", o1.title === "Jollof rice with chicken + 1 more", o1.title);
  const { data: items } = await db.from("request_items").select("name, unit_price_minor, quantity").eq("request_id", o1.id).order("id");
  check("order lines saved", items?.length === 2 && items[0].unit_price_minor === 850_000 && items[1].quantity === 2, items);

  const c1 = await checkout(o1);
  check("checkout goes to the sandbox gateway page", c1.checkoutUrl === `${appUrl}/pay/sandbox/${c1.reference}`, c1.checkoutUrl);
  const p1 = await getPayment(c1.reference);
  check("attempt recorded: sandbox, test mode, initialized", p1?.provider === "sandbox" && p1.mode === "test" && p1.status === "initialized" && p1.amount_minor === 1_350_000, p1);
  check("tapping Pay again reuses the open checkout", (await checkout(o1)).reference === c1.reference);

  const real = await sandboxPayWithCard(c1.reference, "4242 4242 4242 4242");
  check("a non-test card is refused by the sandbox", !real.ok && /Never enter a real card/.test(real.error), real);
  check("…and nothing changed", (await getPayment(c1.reference))?.status === "initialized");

  const declined = await sandboxPayWithCard(c1.reference, CARD_DECLINED);
  check("gateway sends the guest back to /pay/return", declined.ok && declined.redirectTo === `${appUrl}/pay/return?reference=${c1.reference}`, declined);
  const p1f = await getPayment(c1.reference);
  check("declined card: payment failed with the issuer's reason", p1f?.status === "failed" && p1f.failure_reason === "Declined by the card issuer", p1f);
  const o1f = await getRequest(o1.id);
  check("order still waiting, marked payment failed", o1f?.status === "awaiting_payment" && o1f.payment_status === "failed", `${o1f?.status}/${o1f?.payment_status}`);

  const c2 = await checkout(o1);
  check("retry is a new attempt with a new reference", c2.reference !== c1.reference);
  await sandboxPayWithCard(c2.reference, CARD_OK);
  const p2 = await getPayment(c2.reference);
  check("approved card: payment succeeded", p2?.status === "succeeded" && p2.channel === "card" && p2.card_brand === "visa" && p2.card_last4 === "4081" && !!p2.paid_at, p2);
  const o1p = await getRequest(o1.id);
  check("order released to the kitchen automatically (Pending, paid)", o1p?.status === "pending" && o1p.payment_status === "paid", `${o1p?.status}/${o1p?.payment_status}`);
  const dueIn = Math.round((Date.parse(o1p!.due_at!) - Date.now()) / 60000);
  check("kitchen clock starts at payment (due in 40 min)", dueIn >= 39 && dueIn <= 40, dueIn);
  const events1 = await getEvents(o1.id);
  check(
    "timeline: failed attempt, then payment received",
    events1.some((e) => e.kind === "payment_failed") &&
      events1.some((e) => e.kind === "payment" && e.message === "Payment received: ₦13,500 (Visa ••4081, sandbox). Sent to Food and drinks"),
    events1.map((e) => e.message),
  );

  await confirmPayment(c2.reference);
  await confirmPayment(c2.reference);
  check("confirming again changes nothing (redirect + webhook both arrive)", (await getEvents(o1.id)).length === events1.length && (await getRequest(o1.id))?.status === "pending");
  check("paid-at-order food is on the bill and already paid (balance unchanged)", (await balance()) === balance0, { before: balance0, after: await balance() });

  console.log("\nInsufficient funds, then charge to room");
  const o2 = await order([["suya-platter", 1]], "pay_now");
  await sandboxPayWithCard((await checkout(o2)).reference, CARD_NO_FUNDS);
  check("insufficient funds: order waits", (await getRequest(o2.id))?.payment_status === "failed");
  const o2r = await chargeOrderToRoom(o2.id, guest);
  check("charged to room: released to the kitchen", o2r.status === "pending" && o2r.payment_status === "charged_to_room", `${o2r.status}/${o2r.payment_status}`);
  check("bill goes up by ₦6,500", (await balance()) === balance0 + 650_000, await balance());
  const o3 = await order([["coffee", 2]], "charge_to_room");
  check("charge-to-room order goes straight to the kitchen", o3.status === "pending" && o3.payment_status === "charged_to_room" && o3.due_at !== null);
  check("bill goes up by ₦4,000", (await balance()) === balance0 + 1_050_000, await balance());
  const res1 = await reservationRow();
  check("reservation balance follows the bill (naira)", res1.balance === (balance0 + 1_050_000) / 100, res1);

  console.log("\nBank transfer confirms later");
  const o4 = await order([["fruit-platter", 1]], "pay_now");
  const c4 = await checkout(o4);
  await sandboxPayWithTransfer(c4.reference);
  check("transfer started: payment pending", (await getPayment(c4.reference))?.status === "pending");
  check("…order still waiting", (await getRequest(o4.id))?.status === "awaiting_payment");
  await completeSandboxTransfer(c4.reference);
  const p4 = await getPayment(c4.reference);
  check("transfer received: payment succeeded", p4?.status === "succeeded" && p4.channel === "bank_transfer", p4);
  check("…order released", (await getRequest(o4.id))?.status === "pending");
  const beforeCancel = await balance();
  const o4c = await cancelRequest(o4.id, guest);
  check("guest cancels the paid order before the kitchen starts: flagged for a refund", o4c.status === "cancelled" && o4c.follow_up && o4c.follow_up_note === "Refund ₦3,500: paid order cancelled", o4c.follow_up_note);
  check("…and the payment shows as credit on the bill", (await balance()) === beforeCancel - 350_000, await balance());

  console.log("\nCancelled on the checkout page");
  const o5 = await order([["pepper-soup", 1]], "pay_now");
  const c5 = await checkout(o5);
  await sandboxCancel(c5.reference);
  const p5 = await getPayment(c5.reference);
  check("payment abandoned", p5?.status === "abandoned" && p5.failure_reason === "Cancelled by the customer", p5);
  check("order still waiting, guest can retry or charge to room", (await getRequest(o5.id))?.status === "awaiting_payment");
  check("guest can cancel an unpaid order", (await cancelRequest(o5.id, guest)).status === "cancelled");

  console.log("\nGateway reports a different amount");
  const o6 = await order([["chocolate-cake", 1]], "pay_now");
  const c6 = await checkout(o6);
  await db.from("sandbox_transactions").update({ amount_minor: 100 }).eq("reference", c6.reference);
  await sandboxPayWithCard(c6.reference, CARD_OK);
  const p6 = await getPayment(c6.reference);
  check("amount mismatch is not accepted", p6?.status === "failed" && /didn't match/.test(p6.failure_reason ?? ""), p6);
  check("…order not released", (await getRequest(o6.id))?.status === "awaiting_payment");

  console.log("\nMoney after a cancel is flagged for a refund");
  const before7 = await balance();
  const o7 = await order([["soft-drink", 1]], "pay_now");
  const c7 = await checkout(o7);
  await cancelRequest(o7.id, guest);
  await sandboxPayWithCard(c7.reference, CARD_OK);
  const o7r = await getRequest(o7.id);
  check("order stays cancelled", o7r?.status === "cancelled");
  check("flagged for a refund on the dashboard", o7r?.follow_up === true && (o7r.follow_up_note ?? "").startsWith("Refund ₦1,200"), o7r?.follow_up_note);
  check("the money shows as a credit on the bill", (await balance()) === before7 - 120_000, await balance());

  console.log("\nPay the bill");
  const due = await balance();
  check("bill has something to pay", due > 0, due);
  const bill = await startCheckout({
    hotelId: hotel!.id,
    merchantName: hotel!.name,
    reservationId: stay!.id,
    purpose: "bill",
    amountMinor: due,
    description: `Room 204 · bill for booking ${stay!.booking_ref}`,
    email: "david.okafor@example.com",
  });
  await sandboxPayWithCard(bill.reference, CARD_OK_MC);
  const pb = await getPayment(bill.reference);
  check("bill payment succeeded (Mastercard)", pb?.status === "succeeded" && pb.card_brand === "mastercard" && pb.purpose === "bill", pb);
  const folio = await computeFolio(db, stay!.id);
  check("bill settled", folio?.balanceMinor === 0, folio?.balanceMinor);
  const res2 = await reservationRow();
  check("reservation shows Paid", res2.balance === 0 && res2.payment_status === "paid", res2);
  const history = await listPayments({ hotelId: hotel!.id, reservationId: stay!.id });
  check(
    "transaction history has every attempt",
    history.filter((p) => p.status === "failed").length === 3 &&
      history.filter((p) => p.status === "abandoned").length === 1 &&
      history.filter((p) => p.status === "succeeded").length === 5,
    history.map((p) => `${p.purpose}:${p.status}`),
  );

  console.log("\nWebhook signatures");
  const body = JSON.stringify({ event: "charge.success", data: { reference: c2.reference } });
  const sandbox = sandboxProvider(appUrl);
  check("sandbox: good signature accepted", (await sandbox.parseWebhook(body, new Headers({ "x-sandbox-signature": signSandboxPayload(body) })))?.reference === c2.reference);
  check("sandbox: bad signature refused", (await sandbox.parseWebhook(body, new Headers({ "x-sandbox-signature": "0".repeat(128) }))) === null);
  check("sandbox: edited body refused", (await sandbox.parseWebhook(body.replace("success", "failed"), new Headers({ "x-sandbox-signature": signSandboxPayload(body) }))) === null);
  const testKey = "sk_test_e2e_not_a_real_key";
  const ps = paystackProvider(testKey);
  const sig = createHmac("sha512", testKey).update(body).digest("hex");
  check("paystack: good signature accepted", (await ps.parseWebhook(body, new Headers({ "x-paystack-signature": sig })))?.reference === c2.reference);
  check("paystack: signature from another key refused", (await ps.parseWebhook(body, new Headers({ "x-paystack-signature": createHmac("sha512", "sk_test_other").update(body).digest("hex") }))) === null);
  check("paystack: missing signature refused", (await ps.parseWebhook(body, new Headers())) === null);

  console.log("\nPaystack adapter (HTTP mocked)");
  mockPaystack();
  try {
    paystackCalls = [];
    paystackReply = () => ({ status: true, data: { authorization_url: "https://checkout.paystack.com/abc123", access_code: "abc123", reference: "R1" } });
    const init = await ps.initialize({
      reference: "NXP-TEST-1",
      amountMinor: 1_350_000,
      currency: "NGN",
      email: "david.okafor@example.com",
      merchantName: "Amber Coast Hotel",
      description: "Room 204 · Jollof",
      callbackUrl: `${appUrl}/pay/return`,
      metadata: { purpose: "order" },
    });
    const call = paystackCalls[0];
    check("initialize: POST /transaction/initialize with the secret key", call?.method === "POST" && call.url.endsWith("/transaction/initialize") && call.auth === `Bearer ${testKey}`, call);
    check("initialize: amount in kobo, currency, reference, callback", call?.body?.amount === 1_350_000 && call.body.currency === "NGN" && call.body.reference === "NXP-TEST-1" && call.body.callback_url === `${appUrl}/pay/return`, call?.body);
    check("initialize: hosted checkout URL returned", init.checkoutUrl === "https://checkout.paystack.com/abc123");

    const verifyAs = async (data: Record<string, unknown>) => {
      paystackReply = () => ({ status: true, data });
      return ps.verify("NXP-TEST-1");
    };
    const v1 = await verifyAs({ status: "success", amount: 1_350_000, currency: "NGN", paid_at: "2026-11-13T12:00:00.000Z", channel: "card", authorization: { brand: "visa", last4: "4081" } });
    check("verify success → succeeded, with card details", v1.status === "succeeded" && v1.amountMinor === 1_350_000 && v1.cardLast4 === "4081" && v1.cardBrand === "visa", v1);
    check("verify abandoned → not finished yet (guest may still pay)", (await verifyAs({ status: "abandoned", amount: 1_350_000 })).status === "initialized");
    const v3 = await verifyAs({ status: "failed", amount: 1_350_000, gateway_response: "Declined" });
    check("verify failed → failed with the gateway's reason", v3.status === "failed" && v3.failureReason === "Declined", v3);
    check("verify reversed → refunded", (await verifyAs({ status: "reversed", amount: 1_350_000 })).status === "refunded");
    check("verify ongoing → pending", (await verifyAs({ status: "ongoing", amount: 1_350_000 })).status === "pending");
    paystackReply = () => ({ status: false, message: "Invalid key" });
    await expectThrows("API error surfaces as a provider error", () => ps.verify("NXP-TEST-1"), (e) => e instanceof PaymentError && e.code === "provider");

    console.log("\nSwitch to Paystack test mode by configuration only");
    setEnv({ PAYMENT_PROVIDER: "paystack", PAYSTACK_SECRET_KEY: testKey });
    check("config: Paystack, test mode, no problem", paymentsConfig().providerId === "paystack" && paymentsConfig().mode === "test" && !paymentsConfig().problem);
    const o8 = await order([["club-sandwich", 1]], "pay_now");
    paystackReply = () => ({ status: true, data: { authorization_url: "https://checkout.paystack.com/xyz789", access_code: "xyz789" } });
    const c8 = await checkout(o8);
    const p8 = await getPayment(c8.reference);
    check("same checkout code now uses Paystack hosted checkout", c8.checkoutUrl === "https://checkout.paystack.com/xyz789" && p8?.provider === "paystack" && p8.mode === "test", p8);
    paystackReply = () => ({ status: true, data: { status: "abandoned", amount: 750_000, currency: "NGN" } });
    await confirmPayment(c8.reference);
    check("guest still on Paystack's page: attempt stays open", (await getPayment(c8.reference))?.status === "initialized");
    paystackReply = () => ({ status: true, data: { status: "success", amount: 750_000, currency: "NGN", paid_at: new Date().toISOString(), channel: "card", authorization: { brand: "visa", last4: "4081" } } });
    await confirmPayment(c8.reference);
    check("Paystack success: payment succeeded", (await getPayment(c8.reference))?.status === "succeeded");
    check("…order released to the kitchen", (await getRequest(o8.id))?.status === "pending");

    console.log("\nLate success after we marked it failed");
    const o9 = await order([["orange-juice", 1]], "pay_now");
    paystackReply = () => ({ status: true, data: { authorization_url: "https://checkout.paystack.com/late", access_code: "late" } });
    const c9 = await checkout(o9);
    paystackReply = () => ({ status: true, data: { status: "failed", amount: 300_000, currency: "NGN", gateway_response: "Declined" } });
    await confirmPayment(c9.reference);
    check("first try failed", (await getPayment(c9.reference))?.status === "failed");
    paystackReply = () => ({ status: true, data: { status: "success", amount: 300_000, currency: "NGN", paid_at: new Date().toISOString(), channel: "card", authorization: { brand: "visa", last4: "4081" } } });
    await confirmPayment(c9.reference); // e.g. the charge.success webhook
    check("retry on the same Paystack page succeeded: recorded, not lost", (await getPayment(c9.reference))?.status === "succeeded");
    check("…order released", (await getRequest(o9.id))?.status === "pending");
  } finally {
    unmockPaystack();
  }

  console.log("\nLive keys are blocked unless explicitly allowed");
  setEnv({ PAYMENT_PROVIDER: "paystack" });
  check("no key: payments off with a clear reason", paymentsConfig().problem === "PAYSTACK_SECRET_KEY is not set.");
  await expectThrows("no key: checkout refused", () => activeProvider(), (e) => e instanceof PaymentError && e.code === "config");
  setEnv({ PAYMENT_PROVIDER: "paystack", PAYSTACK_SECRET_KEY: "pk_test_public_key_by_mistake" });
  check("public key by mistake: refused", /should start with sk_/.test(paymentsConfig().problem ?? ""));
  setEnv({ PAYMENT_PROVIDER: "paystack", PAYSTACK_SECRET_KEY: "sk_live_not_a_real_key" });
  check("live key without PAYMENTS_ALLOW_LIVE: blocked", paymentsConfig().mode === "live" && /blocked/.test(paymentsConfig().problem ?? ""));
  await expectThrows(
    "live key without PAYMENTS_ALLOW_LIVE: checkout refused before anything is charged",
    () => checkout({ id: o6.id, amount_minor: o6.amount_minor, title: o6.title }),
    (e) => e instanceof PaymentError && e.code === "config",
  );
  setEnv({ PAYMENT_PROVIDER: "paystack", PAYSTACK_SECRET_KEY: "sk_live_not_a_real_key", PAYMENTS_ALLOW_LIVE: "true" });
  check("live key + PAYMENTS_ALLOW_LIVE=true: live mode enabled", paymentsConfig().mode === "live" && paymentsConfig().problem === null);
  setEnv({ PAYMENT_PROVIDER: "flutterwave" });
  check("unknown provider falls back to the sandbox with a note", paymentsConfig().providerId === "sandbox" && !!paymentsConfig().note);
  restoreEnv();
  setEnv({ PAYMENT_PROVIDER: "sandbox" });

  console.log("\nManager dashboard data");
  const recent = await listPayments({ hotelId: hotel!.id, since: new Date(Date.now() - 60 * 60_000).toISOString() });
  check("payments list shows every attempt from this run", recent.filter((p) => p.reservation_id === stay!.id).length === 10, recent.length);
  const waiting = await listRequests({ hotelId: hotel!.id, statuses: ["awaiting_payment"], limit: 50 });
  check("orders awaiting payment are listed", waiting.some((r) => r.id === o6.id), waiting.map((r) => r.code));

  restoreEnv();
  await seedDemo(db, { password: process.env.DEMO_STAFF_PASSWORD || "nexora-demo-2026" });
  console.log(`\n${failures ? `${failures} check(s) failed` : "All payment checks passed"}. Demo data reset.`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
