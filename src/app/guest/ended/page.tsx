import type { Metadata } from "next";
import { MessageCircle, Phone } from "lucide-react";
import { getHotel } from "@/lib/hotel";

export const metadata: Metadata = { title: "Guest access" };

const MESSAGES: Record<string, { title: string; body: string }> = {
  "checked-out": { title: "Your stay has ended.", body: "Thank you for staying with us. We hope to see you again." },
  expired: { title: "This link has expired.", body: "Ask reception for a new one." },
  revoked: { title: "This link has expired.", body: "Ask reception for a new one." },
  invalid: { title: "This link isn't valid.", body: "Scan the code on your room card, or ask reception for a new link." },
  "signed-out": { title: "Open your room link to continue.", body: "Scan the code on your room card, or use the link we sent you." },
};

// G10: access ended or invalid. Works without a session.
export default async function GuestEndedPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const msg = MESSAGES[reason ?? "signed-out"] ?? MESSAGES["signed-out"];
  const hotel = await getHotel().catch(() => null);

  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-hotel-canvas px-6"
      style={hotel ? ({ "--hotel-accent": hotel.accent_color, "--hotel-canvas": hotel.canvas_color } as React.CSSProperties) : undefined}
    >
      <div className="w-full max-w-sm text-center">
        <p className="text-sm font-semibold text-hotel">{hotel?.name ?? "Guest services"}</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight">{msg.title}</h1>
        <p className="mt-2 text-[15px] text-muted">{msg.body}</p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          {hotel?.phone ? (
            <a href={`tel:${hotel.phone.replace(/\s/g, "")}`} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-hotel font-semibold text-white">
              <Phone className="size-5" aria-hidden="true" /> Call
            </a>
          ) : null}
          {hotel?.whatsapp ? (
            <a
              href={`https://wa.me/${hotel.whatsapp.replace(/[^\d]/g, "")}`}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface font-semibold"
            >
              <MessageCircle className="size-5" aria-hidden="true" /> WhatsApp
            </a>
          ) : null}
        </div>
        <p className="mt-10 text-xs text-muted">Powered by NEXORA</p>
      </div>
    </div>
  );
}
