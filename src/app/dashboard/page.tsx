import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { getHotel, listStaff } from "@/lib/hotel";
import { dayStart, getInsights, getOverview } from "@/lib/stats";
import { db } from "@/lib/db";
import { fmtMinor, fmtDate, fmtTime, firstName, greeting, isRecent } from "@/lib/format";
import { shiftSummary } from "@/lib/ai/summary";
import { Card, CardHeader, EmptyState, KpiTile } from "@/components/ui";
import { Chip } from "@/components/status";
import { StatusDonut, WorkloadBars } from "@/components/dashboard/charts";
import { RequestRow } from "@/components/dashboard/request-row";
import { RequestDrawer } from "@/components/dashboard/request-drawer";

export const metadata: Metadata = { title: "Overview" };

const ATTENTION_TONE = { refund: "alert", overdue: "alert", not_resolved: "alert", urgent: "alert", waiting: "progress", follow_up: "neutral" } as const;

// M2: "What needs me right now?" answered within five seconds.
export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r: openId } = await searchParams;
  const manager = await requireManager();
  const hotel = await getHotel();
  const staff = await listStaff(hotel.id);
  const [o, insights, { data: paidToday }] = await Promise.all([
    getOverview(hotel, staff),
    getInsights(hotel),
    db()
      .from("payments")
      .select("amount_minor")
      .eq("hotel_id", hotel.id)
      .eq("status", "succeeded")
      .neq("purpose", "deposit")
      .gte("paid_at", new Date(dayStart(hotel.timezone)).toISOString()),
  ]);
  const collectedToday = ((paidToday as { amount_minor: number }[]) ?? []).reduce((a, p) => a + p.amount_minor, 0);
  const summary = await shiftSummary(hotel, o, insights);
  const tz = hotel.timezone;
  const now = new Date();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            {greeting(tz)}, {firstName(manager.full_name)}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {fmtDate(now, tz)} · {fmtTime(now, tz)} · {hotel.name}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Rooms occupied" value={`${o.rooms.occupied}/${o.rooms.total}`} sub={`${o.rooms.available} available`} href="/dashboard/rooms" />
        <KpiTile label="In-house stays" value={o.stays.inHouse} sub={`${o.stays.arrivalsToday} still to arrive · ${o.stays.departuresToday} leaving today`} href="/dashboard/reservations" />
        <KpiTile label="Pending requests" value={o.open.pending} sub={`${o.open.total} open in total`} href="/dashboard/requests" />
        <KpiTile label="Completed today" value={o.completedToday} sub={`of ${o.createdToday} received`} />
        <KpiTile label="Overdue" value={o.overdue} sub={o.waiting ? `${o.waiting} waiting for an owner` : "Nothing waiting"} tone={o.overdue ? "alert" : undefined} href="/dashboard/requests?flag=overdue" />
        <KpiTile
          label="Avg response today"
          value={o.avgResponseToday === null ? "—" : `${o.avgResponseToday}m`}
          sub={`Target ${o.responseTarget} min, sent → started`}
        />
        <KpiTile label="Staff on duty" value={`${o.staffOnDuty}/${o.staffTotal}`} sub="Assignable now" href="/dashboard/staff" />
        <KpiTile label="Collected today" value={fmtMinor(collectedToday, hotel.currency)} sub="Orders and bill payments" href="/dashboard/payments" />
      </section>

      <section className="grid gap-5 xl:grid-cols-12">
        <Card className="overflow-hidden xl:col-span-7">
          <CardHeader
            title="Live requests"
            subtitle="Newest first, today"
            action={
              <Link href="/dashboard/requests" className="flex items-center gap-1 text-sm font-medium text-accent">
                Board <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          />
          {o.feed.length ? (
            <div className="border-t border-line">
              {o.feed.map((r) => (
                <RequestRow key={r.id} r={r} tz={tz} href={`/dashboard?r=${r.id}`} fresh={isRecent(r.created_at, 90_000)} />
              ))}
            </div>
          ) : (
            <EmptyState title="No requests yet today." />
          )}
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader title="Needs attention" subtitle="Overdue, unhappy guests, urgent, waiting" />
          {o.needsAttention.length ? (
            <ul className="space-y-2 px-5 pb-5">
              {o.needsAttention.map((a) => (
                <li key={`${a.reason}-${a.request.id}`}>
                  <Link
                    href={`/dashboard?r=${a.request.id}`}
                    scroll={false}
                    className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 hover:border-line-strong hover:bg-subtle"
                  >
                    <span className="w-12 font-display text-base font-extrabold tabular-nums">{a.request.room?.number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{a.request.title}</span>
                      <span className="block text-xs text-muted">
                        {a.request.code} · {a.request.assignee ? firstName(a.request.assignee.full_name) : "No owner"}
                      </span>
                    </span>
                    <Chip tone={ATTENTION_TONE[a.reason]}>{a.label}</Chip>
                    <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">{a.request.assignee ? "Open" : "Assign"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing needs you right now." />
          )}
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Open work by department" />
          <div className="px-5 pb-5">
            <WorkloadBars rows={o.workload} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Today's requests" subtitle="By status" />
          <div className="px-5 pb-5">
            <StatusDonut
              total={o.createdToday}
              label="today"
              segments={[
                { label: "Pending", value: o.statusMixToday.pending, color: "var(--color-pending)" },
                { label: "Assigned", value: o.statusMixToday.assigned, color: "var(--color-assigned)" },
                { label: "In progress", value: o.statusMixToday.in_progress, color: "#E59A1A" },
                { label: "Completed", value: o.statusMixToday.completed, color: "#1FA35B" },
                { label: "Cancelled", value: o.statusMixToday.cancelled, color: "var(--color-line-strong)" },
              ]}
            />
          </div>
        </Card>
        <div className="flex flex-col rounded-2xl bg-ink p-5 text-white">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-bold">Shift summary</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/25 px-2 py-0.5 text-[11px] font-medium">
              <Sparkles className="size-3" aria-hidden="true" />
              {summary.engine === "claude" ? "AI-generated · check before acting" : "Auto-summary from today's data"}
            </span>
          </div>
          <ul className="mt-4 flex-1 space-y-3 text-[15px] leading-snug">
            {summary.lines.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
          <Link href="/dashboard/insights" className="mt-4 text-sm font-medium text-white/70 hover:text-white">
            Show the data behind this →
          </Link>
        </div>
      </section>

      <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
        <span className="font-display text-[15px] font-bold">Rooms right now</span>
        {[
          { label: "Available", value: o.rooms.available, c: "bg-done" },
          { label: "Occupied", value: o.rooms.occupied, c: "bg-assigned" },
          { label: "Cleaning", value: o.rooms.cleaning, c: "bg-[#E59A1A]" },
          { label: "Maintenance", value: o.rooms.maintenance, c: "bg-alert-solid" },
        ].map((s) => (
          <Link key={s.label} href={`/dashboard/rooms?status=${s.label.toLowerCase()}`} className="flex items-center gap-2 text-sm hover:underline">
            <span className={`size-2.5 rounded-full ${s.c}`} aria-hidden="true" />
            {s.label} <span className="font-semibold tabular-nums">{s.value}</span>
          </Link>
        ))}
        <Link href="/dashboard/rooms" className="ml-auto text-sm font-medium text-accent">
          Room board →
        </Link>
      </Card>

      {openId ? <RequestDrawer requestId={openId} closeHref="/dashboard" hotelTz={tz} /> : null}
    </div>
  );
}
