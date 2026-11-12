import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { X } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { getHotel, getReservation, guestLink, listReservations } from "@/lib/hotel";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, fmtMoney, todayISO, fmtMinor } from "@/lib/format";
import { RESERVATION_STATUS_LABEL } from "@/lib/labels";
import { accessProblem } from "@/lib/guest-session";
import { checkInAction, checkOutAction, issueAccessAction, revokeAccessAction } from "@/app/actions/manager";
import { cn } from "@/lib/cn";
import { Card, PageTitle } from "@/components/ui";
import { Chip } from "@/components/status";
import { ActionButton } from "@/components/client/action-button";
import { CopyButton } from "@/components/client/copy-button";
import type { Reservation } from "@/lib/types";
import { computeFolio } from "@/lib/payments/folio";
import { listPayments } from "@/lib/payments/service";
import { PaymentMethod, PaymentStatusChip, TestModeBadge } from "@/components/payments/payment-bits";

export const metadata: Metadata = { title: "Reservations" };

const TABS = [
  { key: "arrivals", label: "Arrivals today" },
  { key: "inhouse", label: "In house" },
  { key: "departures", label: "Departures today" },
  { key: "all", label: "All" },
];

function accessState(r: Reservation): { label: string; tone: "done" | "neutral" | "alert" } {
  if (!r.access_token) return { label: "Not issued", tone: "neutral" };
  if (accessProblem(r)) return { label: r.access_revoked_at ? "Revoked" : "Ended", tone: "alert" };
  return { label: "Active", tone: "done" };
}

// M9: who's arriving, staying and leaving, plus each stay's guest access link.
export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ tab?: string; res?: string }> }) {
  const { tab = "inhouse", res: openRes } = await searchParams;
  await requireManager();
  const hotel = await getHotel();
  const today = todayISO(hotel.timezone);
  const all = await listReservations(hotel.id);
  const list = all
    .filter((r) =>
      tab === "arrivals"
        ? r.check_in === today && (r.status === "confirmed" || r.status === "checked_in")
        : tab === "departures"
          ? r.check_out === today && r.status === "checked_in"
          : tab === "inhouse"
            ? r.status === "checked_in"
            : true,
    )
    .sort((a, b) => a.room.number.localeCompare(b.room.number));

  const selected = openRes ? await getReservation(openRes) : null;
  const link = selected?.access_token ? guestLink(selected.access_token) : null;
  const qrSvg = link ? await QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#0D0D0D", light: "#FFFFFF" } }) : null;
  const stayRequests = selected
    ? ((await db().from("requests").select("id", { count: "exact", head: true }).eq("reservation_id", selected.id)).count ?? 0)
    : 0;
  const [folio, stayPayments] = selected
    ? await Promise.all([computeFolio(db(), selected.id), listPayments({ hotelId: hotel.id, reservationId: selected.id, limit: 20 })])
    : [null, []];
  const href = (patch: { tab?: string; res?: string }) => {
    const q = new URLSearchParams({ tab: patch.tab ?? tab });
    const r = "res" in patch ? patch.res : openRes;
    if (r) q.set("res", r);
    return `/dashboard/reservations?${q}`;
  };

  return (
    <div>
      <PageTitle title="Reservations" subtitle="Check guests in and out, and hand them their room link." />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => (
          <Link key={t.key} href={href({ tab: t.key, res: undefined })} className={cn("rounded-full border px-3 py-1.5 font-medium", tab === t.key ? "border-ink bg-ink text-white" : "border-line bg-surface")}>
            {t.label}
          </Link>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              {["Guest", "Room", "Check-in", "Check-out", "Nights", "Status", "Guest access", "Payment"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const access = accessState(r);
              const nights = Math.max(1, Math.round((Date.parse(r.check_out) - Date.parse(r.check_in)) / 86_400_000));
              return (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-subtle">
                  <td className="px-4 py-2.5">
                    <Link href={href({ res: r.id })} scroll={false} className="font-semibold text-ink hover:text-accent">
                      {[r.guest.title, r.guest.first_name, r.guest.last_name].filter(Boolean).join(" ")}
                    </Link>
                    <p className="text-xs text-muted">{r.booking_ref}</p>
                  </td>
                  <td className="px-4 py-2.5 font-display font-extrabold tabular-nums">{r.room.number}</td>
                  <td className="px-4 py-2.5">{fmtDate(r.check_in)}</td>
                  <td className="px-4 py-2.5">{fmtDate(r.check_out)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{nights}</td>
                  <td className="px-4 py-2.5">
                    <Chip tone={r.status === "checked_in" ? "assigned" : r.status === "confirmed" ? "pending" : "neutral"}>{RESERVATION_STATUS_LABEL[r.status]}</Chip>
                  </td>
                  <td className="px-4 py-2.5">
                    <Chip tone={access.tone}>{access.label}</Chip>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{r.balance ? `${fmtMoney(r.balance, hotel.currency)} due` : "Paid"}</td>
                </tr>
              );
            })}
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  Nobody in this list.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {selected ? (
        <div className="fixed inset-0 z-40">
          <Link href={href({ res: undefined })} scroll={false} aria-label="Close" className="absolute inset-0 bg-ink/25" />
          <aside role="dialog" aria-modal="true" aria-label="Reservation" className="absolute inset-y-0 right-0 w-full max-w-[440px] animate-rise overflow-y-auto bg-surface p-5 shadow-float">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted">{selected.booking_ref}</p>
                <h2 className="font-display text-xl font-extrabold">{[selected.guest.title, selected.guest.first_name, selected.guest.last_name].filter(Boolean).join(" ")}</h2>
                <p className="text-sm text-muted">
                  Room {selected.room.number} · {fmtDate(selected.check_in)} – {fmtDate(selected.check_out)} · {stayRequests} request{stayRequests === 1 ? "" : "s"} this stay
                </p>
                <p className="text-sm text-muted">
                  {selected.guest.phone} · {selected.guest.email}
                </p>
              </div>
              <Link href={href({ res: undefined })} scroll={false} className="rounded-full p-2 text-muted hover:bg-black/5" aria-label="Close">
                <X className="size-5" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-4 flex gap-2">
              {selected.status === "confirmed" ? (
                <ActionButton action={checkInAction.bind(null, selected.id)} className="flex-1">
                  Check in
                </ActionButton>
              ) : null}
              {selected.status === "checked_in" ? (
                <ActionButton
                  action={checkOutAction.bind(null, selected.id)}
                  variant="secondary"
                  className="flex-1"
                  confirmText={`Check out ${selected.guest.first_name}? Their link stops working, Room ${selected.room.number} goes to Cleaning and housekeeping gets a task.`}
                >
                  Check out
                </ActionButton>
              ) : null}
            </div>

            {folio ? (
              <section className="mt-6 rounded-2xl border border-line p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display font-bold">Bill</h3>
                  <span className={folio.balanceMinor > 0 ? "font-display text-lg font-extrabold text-alert tabular-nums" : "text-sm font-semibold text-done"}>
                    {folio.balanceMinor > 0
                      ? `${fmtMinor(folio.balanceMinor, folio.currency)} due`
                      : folio.balanceMinor < 0
                        ? `${fmtMinor(-folio.balanceMinor, folio.currency)} credit to refund`
                        : "Settled"}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {folio.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate">{l.label}</span>
                        {l.detail ? <span className="block text-xs text-muted">{l.detail}</span> : null}
                      </span>
                      <span className={l.kind === "payment" ? "text-done tabular-nums" : "tabular-nums"}>
                        {l.kind === "payment" ? "−" : ""}
                        {fmtMinor(l.amountMinor, folio.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
                {stayPayments.length ? (
                  <>
                    <h4 className="mt-4 mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Transactions</h4>
                    <ul className="space-y-1.5 text-xs">
                      {stayPayments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            {fmtMinor(p.amount_minor, p.currency)} · <PaymentMethod p={p} /> <TestModeBadge mode={p.mode} />
                          </span>
                          <PaymentStatusChip status={p.status} />
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
            ) : null}

            <section className="mt-6 rounded-2xl border border-line p-4">
              <h3 className="font-display font-bold">Guest access</h3>
              {link && !accessProblem(selected) ? (
                <>
                  <div className="mt-3 flex gap-4">
                    <div className="size-36 shrink-0 rounded-xl border border-line p-1.5 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg! }} />
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="text-muted">Room code</span>
                        <br />
                        <span className="font-mono text-2xl font-bold tracking-widest">{selected.access_code}</span>
                      </p>
                      <p className="text-xs text-muted">Ends at checkout, {selected.access_expires_at ? fmtDateTime(selected.access_expires_at, hotel.timezone) : "—"}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-subtle px-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{link}</span>
                    <CopyButton value={link} label="Copy link" />
                  </div>
                  <p className="mt-2 text-xs text-muted">The guest confirms their last name on first open. Sending by WhatsApp or SMS is next on the roadmap.</p>
                  <div className="mt-3 flex gap-2">
                    <ActionButton action={issueAccessAction.bind(null, selected.id)} variant="secondary" size="sm" confirmText="Issue a new link? The current link and QR code stop working.">
                      New link
                    </ActionButton>
                    <ActionButton action={revokeAccessAction.bind(null, selected.id)} variant="danger" size="sm" confirmText="Revoke guest access now?">
                      Revoke
                    </ActionButton>
                  </div>
                </>
              ) : (
                <div className="mt-2 space-y-3 text-sm">
                  <p className="text-muted">{selected.status === "checked_in" ? "No active link for this stay." : "A link is issued at check-in."}</p>
                  {selected.status === "checked_in" ? (
                    <ActionButton action={issueAccessAction.bind(null, selected.id)} size="sm">
                      Issue guest link
                    </ActionButton>
                  ) : null}
                </div>
              )}
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
