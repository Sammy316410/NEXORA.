import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Coffee, Sparkles, Wifi, Wrench, ConciergeBell } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { listRequests } from "@/lib/requests";
import { listServices } from "@/lib/hotel";
import { fmtDate, greeting } from "@/lib/format";
import { OPEN_STATUSES } from "@/lib/sla";
import { ServiceIcon } from "@/components/icons";
import { StatusChip } from "@/components/status";
import { MiniProgress } from "@/components/guest/progress";
import { CopyButton } from "@/components/client/copy-button";
import { TimeAgo } from "@/components/client/due-chip";

export const metadata: Metadata = { title: "Home" };

// G2: greeting, active requests, the service grid and quick info.
export default async function GuestHome() {
  const { hotel, guest, room, reservation } = await requireGuest();
  const [open, services] = await Promise.all([
    listRequests({ hotelId: hotel.id, reservationId: reservation.id, statuses: [...OPEN_STATUSES, "awaiting_payment"], limit: 10 }),
    listServices(hotel.id, { guestVisibleOnly: true }),
  ]);
  const featured = services.filter((s) => s.featured);

  const tiles = [
    ...featured.map((s) => ({
      href: s.id === "food-order" ? "/guest/order" : `/guest/request/${s.id}`,
      label: s.name,
      icon: <ServiceIcon icon={s.icon} className="size-7" />,
    })),
    { href: "/guest/request?category=maintenance", label: "Maintenance", icon: <Wrench className="size-7" strokeWidth={1.75} aria-hidden="true" /> },
    { href: "/guest/request?category=front_desk", label: "Front desk help", icon: <ConciergeBell className="size-7" strokeWidth={1.75} aria-hidden="true" /> },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight">
          {greeting(hotel.timezone)}, {guest.first_name}
        </h1>
        <p className="mt-1 text-[15px] text-muted">
          Room {room.number} · {room.room_type} · Check-out {fmtDate(reservation.check_out)}, {hotel.check_out_time}
        </p>
      </section>

      {open.length > 0 ? (
        <section aria-labelledby="active-heading" className="space-y-3">
          <h2 id="active-heading" className="text-sm font-semibold text-muted">
            Your requests
          </h2>
          {open.map((r) => (
            <Link
              key={r.id}
              href={`/guest/requests/${r.id}`}
              className="block animate-rise rounded-2xl border border-line bg-surface p-4 shadow-card active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-hotel/10 text-hotel">
                  <ServiceIcon icon={r.service?.icon} className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[15px] font-bold">{r.title}</p>
                  <p className="text-[13px] text-muted">
                    Updated <TimeAgo at={r.updated_at} />
                  </p>
                </div>
                <StatusChip status={r.status} guest />
              </div>
              <div className="mt-3">
                <MiniProgress status={r.status} />
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-line-strong bg-surface/60 px-4 py-5 text-center">
          <p className="font-display text-[15px] font-bold">Need anything? We&apos;re a tap away.</p>
          <p className="mt-1 text-sm text-muted">Pick a service below and follow it live.</p>
        </section>
      )}

      <section aria-labelledby="help-heading">
        <h2 id="help-heading" className="mb-3 font-display text-lg font-bold">
          How can we help?
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="flex min-h-28 flex-col justify-between rounded-2xl border border-line bg-surface p-4 text-hotel shadow-card transition-colors hover:border-hotel/40 active:scale-[0.98]"
            >
              {t.icon}
              <span className="font-display text-[15px] leading-tight font-bold text-ink">{t.label}</span>
            </Link>
          ))}
          <Link
            href="/guest/describe"
            className="col-span-2 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card hover:border-hotel/40"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-ink text-white">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block font-display text-[15px] font-bold">Something else?</span>
              <span className="block text-[13px] text-muted">Describe it in your own words</span>
            </span>
            <ChevronRight className="size-5 text-muted" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        {hotel.wifi_name ? (
          <div className="flex items-center gap-3">
            <Wifi className="size-5 text-hotel" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{hotel.wifi_name}</p>
              <p className="text-muted">
                Password <span className="font-mono text-ink">{hotel.wifi_password}</span>
              </p>
            </div>
            {hotel.wifi_password ? <CopyButton value={hotel.wifi_password} label="Copy" /> : null}
          </div>
        ) : null}
        {hotel.breakfast_hours ? (
          <div className="flex items-center gap-3 border-t border-line pt-3">
            <Coffee className="size-5 text-hotel" aria-hidden="true" />
            <p className="text-sm">
              <span className="font-semibold">Breakfast</span> <span className="text-muted">{hotel.breakfast_hours}</span>
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
