// The guest's bill for a stay: room nights plus confirmed extras, minus payments.
// Pure data logic (no Next.js imports) so the seed script can use it too.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface FolioLine {
  kind: "charge" | "payment";
  label: string;
  detail: string | null;
  amountMinor: number;
  at: string | null;
  reference?: string;
  requestId?: string;
}

export interface Folio {
  reservationId: string;
  currency: string;
  nights: number;
  chargesMinor: number;
  paidMinor: number;
  balanceMinor: number;
  lines: FolioLine[];
}

export async function computeFolio(db: SupabaseClient, reservationId: string): Promise<Folio | null> {
  const { data: res } = await db
    .from("reservations")
    .select("id, check_in, check_out, room:rooms(number, room_type, rate), hotel:hotels(currency)")
    .eq("id", reservationId)
    .maybeSingle();
  if (!res) return null;
  const room = res.room as unknown as { number: string; room_type: string; rate: number };
  const hotel = res.hotel as unknown as { currency: string };
  const nights = Math.max(1, Math.round((Date.parse(res.check_out) - Date.parse(res.check_in)) / 86_400_000));

  const [{ data: extras }, { data: payments }] = await Promise.all([
    db
      .from("requests")
      .select("id, code, title, amount_minor, payment_status, created_at")
      .eq("reservation_id", reservationId)
      .gt("amount_minor", 0)
      .in("payment_status", ["paid", "charged_to_room"])
      .neq("status", "cancelled")
      .order("created_at"),
    db
      .from("payments")
      .select("reference, purpose, amount_minor, channel, card_brand, card_last4, paid_at, provider")
      .eq("reservation_id", reservationId)
      .eq("status", "succeeded")
      .order("paid_at"),
  ]);

  const lines: FolioLine[] = [
    {
      kind: "charge",
      label: `Room ${room.number} · ${room.room_type}`,
      detail: `${nights} night${nights === 1 ? "" : "s"} × ${(room.rate).toLocaleString("en-NG")}`,
      amountMinor: room.rate * nights * 100,
      at: res.check_in,
    },
  ];
  for (const r of extras ?? []) {
    lines.push({
      kind: "charge",
      label: r.title,
      detail: `${r.code} · ${r.payment_status === "paid" ? "paid at order" : "charged to room"}`,
      amountMinor: r.amount_minor,
      at: r.created_at,
      requestId: r.id,
    });
  }
  for (const p of payments ?? []) {
    const method =
      p.channel === "card" && p.card_last4 ? `${(p.card_brand ?? "Card").replace(/^\w/, (c: string) => c.toUpperCase())} ••${p.card_last4}` : p.channel === "bank_transfer" ? "Bank transfer" : p.channel ?? p.provider;
    lines.push({
      kind: "payment",
      label: p.purpose === "deposit" ? "Paid at booking" : p.purpose === "order" ? "Order payment" : "Bill payment",
      detail: method,
      amountMinor: p.amount_minor,
      at: p.paid_at,
      reference: p.reference,
    });
  }

  const chargesMinor = lines.filter((l) => l.kind === "charge").reduce((a, l) => a + l.amountMinor, 0);
  const paidMinor = lines.filter((l) => l.kind === "payment").reduce((a, l) => a + l.amountMinor, 0);
  return {
    reservationId,
    currency: hotel.currency,
    nights,
    chargesMinor,
    paidMinor,
    balanceMinor: chargesMinor - paidMinor,
    lines,
  };
}

/** Keep reservations.balance / payment_status in step with the folio. */
export async function syncReservationBalance(db: SupabaseClient, reservationId: string): Promise<Folio | null> {
  const folio = await computeFolio(db, reservationId);
  if (!folio) return null;
  const balance = Math.max(0, Math.round(folio.balanceMinor / 100));
  const status = folio.balanceMinor <= 0 ? "paid" : folio.paidMinor > 0 ? "part_paid" : "unpaid";
  await db.from("reservations").update({ balance, payment_status: status }).eq("id", reservationId);
  return folio;
}
