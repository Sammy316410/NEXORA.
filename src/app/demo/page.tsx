import Link from "next/link";
import { connection } from "next/server";
import QRCode from "qrcode";
import { ArrowRight, LayoutDashboard, QrCode, Smartphone } from "lucide-react";
import { db } from "@/lib/db";
import { guestLink, getHotel } from "@/lib/hotel";
import { resetDemoAction } from "@/app/actions/manager";
import { NexoraLogo } from "@/components/brand";
import { ActionButton } from "@/components/client/action-button";
import { buttonClass } from "@/components/ui";
import { TEAM_GUEST } from "@/lib/seed/catalog";

// X1: the demo launcher. Three doors, the team room's QR code and a reset button.
export const metadata = { title: "Live demo" };

export default async function LauncherPage() {
  await connection(); // always render per request: the QR code points at live data
  const demo = process.env.NEXORA_DEMO_MODE === "true";

  if (!demo) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <NexoraLogo />
        <p className="font-display text-3xl font-extrabold tracking-tight">Every request accounted for.</p>
        <Link href="/login" className={buttonClass("primary", "lg")}>
          Staff sign in
        </Link>
      </main>
    );
  }

  let link: string | null = null;
  let qr: string | null = null;
  let hotelName = "Villa Monument (demo)";
  try {
    const hotel = await getHotel();
    hotelName = hotel.name;
    const { data: room } = await db().from("rooms").select("id").eq("hotel_id", hotel.id).eq("number", TEAM_GUEST.room).maybeSingle();
    const { data: stay } = room
      ? await db().from("reservations").select("access_token").eq("room_id", room.id).eq("status", "checked_in").maybeSingle()
      : { data: null };
    if (stay?.access_token) {
      link = guestLink(stay.access_token);
      qr = await QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#0D0D0D", light: "#FFFFFF" } });
    }
  } catch {
    // Database not seeded yet: the page still renders with instructions.
  }

  return (
    <main className="min-h-dvh bg-canvas px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" aria-label="NEXORA home"><NexoraLogo /></Link>
          <ActionButton action={resetDemoAction} variant="secondary" confirmText="Reset the demo? Requests go back to the two real ones, and payments are cleared." pendingText="Resetting…">
            Reset demo
          </ActionButton>
        </header>

        <section className="mt-12 max-w-2xl">
          <p className="text-sm font-semibold text-accent">{hotelName} · live demo</p>
          <h1 className="mt-2 font-display text-5xl leading-[1.05] font-extrabold tracking-tight">Three people, one system.</h1>
          <p className="mt-4 text-lg text-muted">
            A guest asks from their phone. The front desk assigns in one click. Staff start and finish on theirs. Everyone sees the same request, live.
          </p>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-3">
          <article className="flex flex-col rounded-3xl border border-line bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#0F766E] text-white">
              <QrCode className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-xl font-extrabold">Guest phone</h2>
            <p className="mt-1 text-sm text-muted">Scan the room card. Last name: {TEAM_GUEST.last} ({TEAM_GUEST.room} room).</p>
            {qr ? (
              <div className="mx-auto my-5 size-48 rounded-2xl border border-line p-2 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
            ) : (
              <p className="my-5 rounded-xl bg-progress-bg p-3 text-sm text-progress">Run npm run db:seed to create the demo guest.</p>
            )}
            {link ? (
              <Link href={link} className={buttonClass("secondary", "lg", "mt-auto w-full")}>
                Open guest portal <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
          </article>

          <article className="flex flex-col rounded-3xl border border-line bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-white">
              <Smartphone className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-xl font-extrabold">Staff phone</h2>
            <p className="mt-1 text-sm text-muted">The one-handed task list. Gets a buzz when a task is assigned.</p>
            <div className="mt-auto grid gap-2 pt-6">
              <Link href="/auth/demo?as=porter" prefetch={false} className={buttonClass("primary", "lg", "w-full")}>
                Open as Porter · Lounge
              </Link>
            </div>
          </article>

          <article className="flex flex-col rounded-3xl bg-ink p-6 text-white">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-ink">
              <LayoutDashboard className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-xl font-extrabold">Manager dashboard</h2>
            <p className="mt-1 text-sm text-white/70">The control room: live requests, assignment, rooms, reservations and insights.</p>
            <div className="mt-auto grid gap-2 pt-6">
              <Link href="/auth/demo?as=receptionist" prefetch={false} className={buttonClass("secondary", "lg", "w-full border-white bg-white")}>
                Open as Receptionist · Front desk
              </Link>
              <Link href="/auth/demo?as=manager" prefetch={false} className={buttonClass("secondary", "lg", "w-full")}>
                Open as Duty manager
              </Link>
              <Link href="/login" className="text-center text-sm text-white/70 hover:text-white">
                Or sign in with Workpeg / email
              </Link>
            </div>
          </article>
        </section>

        <p className="mt-8 text-center text-sm text-muted">
          Use one browser or device per staff role: a staff session lives in the browser. Demo staff password: {process.env.DEMO_STAFF_PASSWORD ?? "nexora-demo-2026"}
        </p>
        <p className="mt-2 text-center text-xs text-muted">
          Hackathon demo, not affiliated with Villa Monument Hotel. Room names are from the hotel&apos;s public room card; staff are shown by role only. Room rates and menu prices are samples.
        </p>
      </div>
    </main>
  );
}
