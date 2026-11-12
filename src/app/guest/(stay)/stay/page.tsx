import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Coffee, LogOut, MapPin, MessageCircle, Phone, Wifi } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { fmtDate, fmtMinor } from "@/lib/format";
import { computeFolio } from "@/lib/payments/folio";
import { db } from "@/lib/db";
import { Receipt } from "lucide-react";
import { leaveStay } from "@/app/actions/guest";
import { CopyButton } from "@/components/client/copy-button";

export const metadata: Metadata = { title: "Your stay" };

// G8: booking details and useful hotel information.
export default async function StayPage() {
  const { hotel, guest, room, reservation } = await requireGuest();
  const nights = Math.max(1, Math.round((Date.parse(reservation.check_out) - Date.parse(reservation.check_in)) / 86_400_000));
  const folio = await computeFolio(db(), reservation.id);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Your stay</h1>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">Booking {reservation.booking_ref}</p>
        <p className="mt-1 font-display text-xl font-extrabold">
          {[guest.title, guest.first_name, guest.last_name].filter(Boolean).join(" ")}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted">Check-in</dt>
            <dd className="font-semibold">
              {fmtDate(reservation.check_in)}, {hotel.check_in_time}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Check-out</dt>
            <dd className="font-semibold">
              {fmtDate(reservation.check_out)}, {hotel.check_out_time}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Room</dt>
            <dd className="font-semibold">
              {room.number} · {room.room_type}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Guests · nights</dt>
            <dd className="font-semibold">
              {reservation.adults} · {nights}
            </dd>
          </div>
        </dl>
        <Link
          href="/guest/request/late-checkout"
          className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong text-sm font-semibold"
        >
          <Clock className="size-4" aria-hidden="true" /> Request late checkout
        </Link>
      </section>

      {folio ? (
        <Link href="/guest/bill" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-hotel/40">
          <span className="flex size-11 items-center justify-center rounded-xl bg-hotel/10 text-hotel">
            <Receipt className="size-5" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-[15px] font-bold">Your bill</span>
            <span className="block text-[13px] text-muted">
              {folio.balanceMinor > 0 ? `Balance ${fmtMinor(folio.balanceMinor, folio.currency)} · pay any time` : "All settled · see receipts"}
            </span>
          </span>
          <span className="text-sm font-semibold text-hotel">{folio.balanceMinor > 0 ? "Pay" : "View"}</span>
        </Link>
      ) : null}

      <section className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {hotel.wifi_name ? (
          <div className="flex items-center gap-3 p-4">
            <Wifi className="size-5 text-hotel" aria-hidden="true" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">{hotel.wifi_name}</p>
              <p className="font-mono text-muted">{hotel.wifi_password}</p>
            </div>
            {hotel.wifi_password ? <CopyButton value={hotel.wifi_password} /> : null}
          </div>
        ) : null}
        {hotel.breakfast_hours ? (
          <div className="flex items-center gap-3 p-4 text-sm">
            <Coffee className="size-5 text-hotel" aria-hidden="true" />
            <p>
              <span className="font-semibold">Breakfast</span> <span className="text-muted">{hotel.breakfast_hours}</span>
            </p>
          </div>
        ) : null}
        {hotel.address ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel.name}, ${hotel.address}`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 p-4 text-sm"
          >
            <MapPin className="size-5 text-hotel" aria-hidden="true" />
            <span className="flex-1">{hotel.address}</span>
          </a>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3">
        {hotel.phone ? (
          <a href={`tel:${hotel.phone.replace(/\s/g, "")}`} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-hotel text-[15px] font-semibold text-white">
            <Phone className="size-5" aria-hidden="true" /> Call
          </a>
        ) : null}
        {hotel.whatsapp ? (
          <a
            href={`https://wa.me/${hotel.whatsapp.replace(/[^\d]/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface text-[15px] font-semibold"
          >
            <MessageCircle className="size-5" aria-hidden="true" /> WhatsApp
          </a>
        ) : null}
      </section>

      <form action={leaveStay}>
        <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 text-sm font-medium text-muted">
          <LogOut className="size-4" aria-hidden="true" /> Sign out on this device
        </button>
      </form>
    </div>
  );
}
