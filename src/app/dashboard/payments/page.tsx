import type { Metadata } from "next";
import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { getHotel } from "@/lib/hotel";
import { db } from "@/lib/db";
import { dayStart } from "@/lib/stats";
import { paymentsConfig } from "@/lib/payments/config";
import { fmtDateTime, fmtMinor, fmtMoney, fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, CardHeader, EmptyState, KpiTile, PageTitle } from "@/components/ui";
import { PaymentMethod, PaymentStatusChip, PROVIDER_LABEL, TestModeBadge } from "@/components/payments/payment-bits";
import type { Payment } from "@/lib/types";

export const metadata: Metadata = { title: "Payments" };

type Row = Payment & {
  reservation: { booking_ref: string; room: { number: string }; guest: { first_name: string; last_name: string } } | null;
  request: { id: string; code: string; title: string } | null;
};

const FILTERS = [
  { key: "all", label: "All", statuses: null },
  { key: "succeeded", label: "Paid", statuses: ["succeeded"] },
  { key: "failed", label: "Failed", statuses: ["failed", "abandoned"] },
  { key: "pending", label: "In progress", statuses: ["initialized", "pending"] },
] as const;

// Payments: money in today, what failed, what's still owed, and every transaction.
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  await requireManager();
  const hotel = await getHotel();
  const cfg = paymentsConfig();
  const since = new Date(dayStart(hotel.timezone)).toISOString();
  const filter = FILTERS.find((f) => f.key === status) ?? FILTERS[0];

  let q = db()
    .from("payments")
    .select("*, reservation:reservations(booking_ref, room:rooms(number), guest:guests(first_name, last_name)), request:requests(id, code, title)")
    .eq("hotel_id", hotel.id)
    .neq("purpose", "deposit");
  if (filter.statuses) q = q.in("status", filter.statuses as unknown as string[]);
  const [{ data: rows }, { data: todays }, { data: owed }, { count: awaiting }] = await Promise.all([
    q.order("created_at", { ascending: false }).limit(150),
    db().from("payments").select("status, amount_minor, paid_at, created_at").eq("hotel_id", hotel.id).neq("purpose", "deposit").gte("created_at", since),
    db().from("reservations").select("balance").eq("hotel_id", hotel.id).eq("status", "checked_in").gt("balance", 0),
    db().from("requests").select("id", { count: "exact", head: true }).eq("hotel_id", hotel.id).eq("status", "awaiting_payment"),
  ]);
  const list = (rows as unknown as Row[]) ?? [];
  const today = (todays as Pick<Payment, "status" | "amount_minor" | "paid_at" | "created_at">[]) ?? [];
  const collected = today.filter((p) => p.status === "succeeded").reduce((a, p) => a + p.amount_minor, 0);
  const failedToday = today.filter((p) => p.status === "failed" || p.status === "abandoned").length;
  const outstanding = ((owed as { balance: number }[]) ?? []).reduce((a, r) => a + r.balance, 0);

  return (
    <div className="space-y-5">
      <PageTitle
        title="Payments"
        subtitle="Orders paid at checkout, bill payments, and every attempt, live."
        action={
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold",
              cfg.mode === "test" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-done-bg text-done",
            )}
          >
            {cfg.mode === "test" ? "Test mode" : "Live"} · {cfg.label}
          </span>
        }
      />
      {cfg.problem ? <p className="rounded-xl bg-alert-bg px-4 py-3 text-sm text-alert">Payments are switched off: {cfg.problem}</p> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Collected today" value={fmtMinor(collected, cfg.currency)} sub={`${today.filter((p) => p.status === "succeeded").length} successful payments`} />
        <KpiTile label="Outstanding balances" value={fmtMoney(outstanding, hotel.currency)} sub="In-house guests" href="/dashboard/reservations?tab=inhouse" />
        <KpiTile label="Failed today" value={failedToday} sub="Declined, cancelled or abandoned" tone={failedToday ? "alert" : undefined} href="/dashboard/payments?status=failed" />
        <KpiTile label="Orders awaiting payment" value={awaiting ?? 0} sub="Not sent to the kitchen yet" href="/dashboard/requests?view=table" />
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/dashboard/payments" : `/dashboard/payments?status=${f.key}`}
            className={cn("rounded-full border px-3 py-1.5 font-medium", filter.key === f.key ? "border-ink bg-ink text-white" : "border-line bg-surface")}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <CardHeader title="Transactions" subtitle="Newest first. Each retry is its own transaction." />
        {list.length === 0 ? (
          <EmptyState title="No transactions here yet." />
        ) : (
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-y border-line text-xs text-muted">
              <tr>
                {["Time", "Reference", "Guest", "For", "Method", "Amount", "Status", "Processed by"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-subtle">
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums" title={fmtDateTime(p.created_at, hotel.timezone)}>
                    {fmtTime(p.paid_at ?? p.created_at, hotel.timezone)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{p.reference}</td>
                  <td className="px-4 py-2.5">
                    {p.reservation ? (
                      <>
                        <span className="font-semibold">Room {p.reservation.room.number}</span>
                        <span className="block text-xs text-muted">
                          {p.reservation.guest.first_name} {p.reservation.guest.last_name}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.purpose === "order" && p.request ? (
                      <Link href={`/dashboard/requests?r=${p.request.id}`} className="font-medium text-accent">
                        Order {p.request.code}
                      </Link>
                    ) : (
                      "Room bill"
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <PaymentMethod p={p} />
                  </td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums">{fmtMinor(p.amount_minor, p.currency)}</td>
                  <td className="px-4 py-2.5">
                    <PaymentStatusChip status={p.status} />
                    {p.failure_reason && (p.status === "failed" || p.status === "abandoned") ? (
                      <span className="mt-0.5 block text-xs text-muted">{p.failure_reason}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5">
                      {PROVIDER_LABEL[p.provider] ?? p.provider} <TestModeBadge mode={p.mode} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-xs text-muted">
        Card details never touch NEXORA: guests pay on the gateway&apos;s hosted page, and NEXORA confirms every payment with the gateway before acting on it.
      </p>
    </div>
  );
}
