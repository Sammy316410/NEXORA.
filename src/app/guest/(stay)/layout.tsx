import { Phone } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { listRequests } from "@/lib/requests";
import { topics } from "@/lib/realtime";
import { OPEN_STATUSES } from "@/lib/sla";
import { GuestTabBar } from "@/components/guest/tab-bar";
import { LiveRefresh } from "@/components/client/live-refresh";

// Guest shell: wears the hotel's brand, not NEXORA's. 480px column on desktop.
export default async function GuestLayout({ children }: { children: React.ReactNode }) {
  const { hotel, room, reservation } = await requireGuest();
  const open = await listRequests({ hotelId: hotel.id, reservationId: reservation.id, statuses: [...OPEN_STATUSES, "awaiting_payment"], limit: 20 });
  const initialsOf = hotel.short_name
    .split(" ")
    .map((w) => w[0])
    .join("");

  return (
    <div
      className="min-h-dvh bg-hotel-canvas"
      style={{ "--hotel-accent": hotel.accent_color, "--hotel-canvas": hotel.canvas_color } as React.CSSProperties}
    >
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-hotel-canvas">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-hotel px-4 py-3 text-white">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-white/15 font-display text-sm font-extrabold">
              {initialsOf}
            </span>
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold">{hotel.name}</p>
              <p className="text-xs text-white/80">Room {room.number}</p>
            </div>
          </div>
          {hotel.phone ? (
            <a
              href={`tel:${hotel.phone.replace(/\s/g, "")}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-sm font-medium"
            >
              <Phone className="size-4" aria-hidden="true" />
              Reception
            </a>
          ) : null}
        </header>
        <main className="flex-1 px-4 pt-5 pb-6">{children}</main>
        <p className="pb-24 text-center text-xs text-muted">Powered by NEXORA</p>
        <GuestTabBar openCount={open.length} />
        <LiveRefresh topic={topics.stay(reservation.id)} audience="guest" showIndicator={false} intervalMs={6000} />
      </div>
    </div>
  );
}
