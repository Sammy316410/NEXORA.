import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Phone } from "lucide-react";
import { getReservationByToken } from "@/lib/hotel";
import { accessProblem, getGuest } from "@/lib/guest-session";
import { db } from "@/lib/db";
import { enterStay } from "@/app/actions/guest";
import { AccessForm } from "@/components/guest/access-form";
import type { Hotel } from "@/lib/types";

export const metadata: Metadata = { title: "Welcome" };

// G1: the guest's front door, opened from the room QR code or a WhatsApp/SMS link.
export default async function GuestAccessPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await getReservationByToken(token);
  if (!res) redirect("/guest/ended?reason=invalid");
  const problem = accessProblem(res);
  if (problem) redirect(`/guest/ended?reason=${problem}`);

  const current = await getGuest();
  if (current?.reservation.id === res.id) redirect("/guest");

  const { data } = await db().from("hotels").select("*").eq("id", res.hotel_id).single();
  const hotel = data as Hotel;

  return (
    <div
      className="min-h-dvh bg-hotel-canvas"
      style={{ "--hotel-accent": hotel.accent_color, "--hotel-canvas": hotel.canvas_color } as React.CSSProperties}
    >
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
        <div className="relative overflow-hidden bg-hotel px-6 pt-14 pb-16 text-white">
          <div className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10" aria-hidden="true" />
          <div className="absolute -bottom-24 -left-10 size-56 rounded-full bg-white/5" aria-hidden="true" />
          <div className="relative">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-white/15 font-display text-lg font-extrabold">
              {hotel.short_name
                .split(" ")
                .map((w) => w[0])
                .join("")}
            </span>
            <p className="mt-6 text-sm text-white/80">Welcome to</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{hotel.name}</h1>
            <p className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">Room {res.room.number}</p>
          </div>
        </div>
        <div className="-mt-6 flex-1 rounded-t-3xl bg-hotel-canvas px-6 pt-8 pb-10">
          <p className="mb-6 text-[15px] text-ink">Confirm your last name to request towels, cleaning, repairs and more, and follow every request live.</p>
          <AccessForm action={enterStay.bind(null, token)} />
          {hotel.phone ? (
            <a href={`tel:${hotel.phone.replace(/\s/g, "")}`} className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-hotel">
              <Phone className="size-4" aria-hidden="true" /> Trouble? Call reception
            </a>
          ) : null}
        </div>
        <p className="pb-6 text-center text-xs text-muted">Powered by NEXORA</p>
      </div>
    </div>
  );
}
