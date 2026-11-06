import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CircleCheck } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { listRequests } from "@/lib/requests";
import { fmtTime, fmtDate } from "@/lib/format";
import { isOpen } from "@/lib/sla";
import { ServiceIcon } from "@/components/icons";
import { StatusChip } from "@/components/status";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "My requests" };

// G6: active and past requests for this stay.
export default async function MyRequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string; sent?: string }> }) {
  const { tab, sent } = await searchParams;
  const { hotel, reservation } = await requireGuest();
  const all = await listRequests({ hotelId: hotel.id, reservationId: reservation.id, limit: 100 });
  const showPast = tab === "past";
  const active = (r: (typeof all)[number]) => isOpen(r.status) || r.status === "awaiting_payment";
  const list = all.filter((r) => (showPast ? !active(r) : active(r)));

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">My requests</h1>
      {sent && Number(sent) > 1 ? (
        <p className="flex items-center gap-2 rounded-2xl bg-done-bg px-4 py-3 text-sm font-medium text-done">
          <CircleCheck className="size-4" aria-hidden="true" /> {sent} requests sent. Follow each one below.
        </p>
      ) : null}
      <div role="tablist" className="grid grid-cols-2 rounded-xl bg-line/60 p-1 text-sm font-semibold">
        {[
          { key: "active", label: "Active", href: "/guest/requests" },
          { key: "past", label: "Past", href: "/guest/requests?tab=past" },
        ].map((t) => {
          const active = (t.key === "past") === showPast;
          return (
            <Link
              key={t.key}
              href={t.href}
              role="tab"
              aria-selected={active}
              className={cn("rounded-lg py-2.5 text-center", active ? "bg-surface shadow-card" : "text-muted")}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl bg-surface px-4 py-10 text-center">
          <p className="font-display text-[15px] font-bold">{showPast ? "No past requests yet." : "Nothing in progress."}</p>
          {!showPast ? (
            <Link href="/guest" className="mt-2 inline-block text-sm font-medium text-hotel">
              Need anything? We&apos;re a tap away.
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
          {list.map((r) => (
            <li key={r.id} className="border-b border-line last:border-b-0">
              <Link href={`/guest/requests/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-subtle">
                <span className="flex size-10 items-center justify-center rounded-xl bg-hotel/10 text-hotel">
                  <ServiceIcon icon={r.service?.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{r.title}</span>
                  <span className="block text-[13px] text-muted">
                    {fmtDate(r.created_at, hotel.timezone)}, {fmtTime(r.created_at, hotel.timezone)}
                  </span>
                </span>
                <StatusChip status={r.status} guest />
                <ChevronRight className="size-4 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
