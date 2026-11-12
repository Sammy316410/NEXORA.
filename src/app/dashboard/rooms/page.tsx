import type { Metadata } from "next";
import Link from "next/link";
import { LogIn, LogOut, X } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { getHotel, listRooms } from "@/lib/hotel";
import { listRequests } from "@/lib/requests";
import { fmtDate, fmtMoney, fmtTime, isoMinutesAgo } from "@/lib/format";
import { ROOM_STATUS_CODE, ROOM_STATUS_LABEL } from "@/lib/labels";
import { roomStatusAction } from "@/app/actions/manager";
import { cn } from "@/lib/cn";
import { PageTitle } from "@/components/ui";
import { RoomStatusChip, StatusChip } from "@/components/status";
import { RoomStatusForm } from "@/components/dashboard/room-status-form";
import type { RoomStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Rooms" };

const TILE: Record<RoomStatus, string> = {
  available: "border-done/30 bg-done-bg",
  occupied: "border-assigned/25 bg-assigned-bg",
  cleaning: "border-progress/30 bg-progress-bg",
  maintenance: "border-alert/30 bg-alert-bg",
};
const BAND: Record<RoomStatus, string> = {
  available: "bg-done",
  occupied: "bg-assigned",
  cleaning: "bg-[#E59A1A]",
  maintenance: "bg-alert-solid",
};

// M7 + M8: the room board, with open work on every tile.
export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ status?: string; room?: string }> }) {
  const { status, room: openRoom } = await searchParams;
  await requireManager();
  const hotel = await getHotel();
  const rooms = await listRooms(hotel);
  const shown = rooms.filter((r) => !status || r.status === status);
  const floors = [...new Set(rooms.map((r) => r.floor))].sort();
  const counts = (s: RoomStatus) => rooms.filter((r) => r.status === s).length;
  const selected = openRoom ? rooms.find((r) => r.id === openRoom) : undefined;
  const history = selected
    ? await listRequests({ hotelId: hotel.id, roomId: selected.id, since: isoMinutesAgo(7 * 24 * 60), limit: 20 })
    : [];
  const link = (patch: { status?: string; room?: string }) => {
    const q = new URLSearchParams();
    const s = "status" in patch ? patch.status : status;
    const r = "room" in patch ? patch.room : openRoom;
    if (s) q.set("status", s);
    if (r) q.set("room", r);
    return `/dashboard/rooms${q.size ? `?${q}` : ""}`;
  };

  return (
    <div>
      <PageTitle title="Rooms" subtitle="Status by floor. Open requests show on each tile." />
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Link href={link({ status: undefined })} className={cn("rounded-full border px-3 py-1.5 font-medium", !status ? "border-ink bg-ink text-white" : "border-line bg-surface")}>
          All {rooms.length}
        </Link>
        {(["available", "occupied", "cleaning", "maintenance"] as RoomStatus[]).map((s) => (
          <Link
            key={s}
            href={link({ status: s })}
            title={`Hotel code ${ROOM_STATUS_CODE[s]}`}
            className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium", status === s ? "border-ink bg-ink text-white" : "border-line bg-surface")}
          >
            <span className={cn("size-2 rounded-full", BAND[s])} aria-hidden="true" />
            {ROOM_STATUS_LABEL[s]} {counts(s)}
          </Link>
        ))}
      </div>

      <div className="space-y-6">
        {floors.map((floor) => {
          const list = shown.filter((r) => r.floor === floor);
          if (!list.length) return null;
          return (
            <section key={floor}>
              <h2 className="mb-2 text-sm font-semibold text-muted">Floor {floor}</h2>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-12">
                {list.map((r) => (
                  <Link
                    key={r.id}
                    href={link({ room: r.id })}
                    scroll={false}
                    className={cn("relative flex min-h-[104px] flex-col overflow-hidden rounded-xl border p-2.5 hover:ring-2 hover:ring-ink/10", TILE[r.status])}
                    title={`${ROOM_STATUS_LABEL[r.status]} (${ROOM_STATUS_CODE[r.status]})`}
                  >
                    <span className={cn("absolute inset-x-0 top-0 h-1", BAND[r.status])} aria-hidden="true" />
                    <span className="flex items-start justify-between">
                      <span className="font-display text-lg font-extrabold tabular-nums">{r.number}</span>
                      {r.openRequests ? (
                        <span className="rounded-full bg-ink px-1.5 text-[11px] leading-5 font-bold text-white" title={`${r.openRequests} open requests`}>
                          {r.openRequests}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[11px] text-muted">{r.room_type.split(" ")[0]}</span>
                    <span className="mt-auto truncate text-xs font-medium">
                      {r.stay?.status === "checked_in" ? r.stay.guest.split(" ").slice(-1)[0] : ROOM_STATUS_LABEL[r.status]}
                    </span>
                    <span className="flex gap-1 text-muted">
                      {r.arrivingToday ? <LogIn className="size-3.5" aria-label="Arriving today" /> : null}
                      {r.departingToday ? <LogOut className="size-3.5" aria-label="Due out today" /> : null}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-4 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1"><LogIn className="size-3.5" aria-hidden="true" /> Arriving today</span>
        <span className="flex items-center gap-1"><LogOut className="size-3.5" aria-hidden="true" /> Due out today</span>
        <span>Black badge = open requests</span>
      </p>

      {selected ? (
        <div className="fixed inset-0 z-40">
          <Link href={link({ room: undefined })} scroll={false} aria-label="Close" className="absolute inset-0 bg-ink/25" />
          <aside role="dialog" aria-modal="true" aria-label={`Room ${selected.number}`} className="absolute inset-y-0 right-0 w-full max-w-[420px] animate-rise overflow-y-auto bg-surface p-5 shadow-float">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-4xl font-extrabold tabular-nums">{selected.number}</p>
                <p className="text-sm text-muted">
                  Floor {selected.floor} · {selected.room_type} · {fmtMoney(selected.rate, hotel.currency)}/night
                </p>
              </div>
              <Link href={link({ room: undefined })} scroll={false} className="rounded-full p-2 text-muted hover:bg-black/5" aria-label="Close">
                <X className="size-5" aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <RoomStatusChip status={selected.status} size="md" />
              {selected.status_note ? <span className="text-sm text-muted">{selected.status_note}</span> : null}
            </div>
            <div className="mt-4">
              <RoomStatusForm current={selected.status} action={roomStatusAction.bind(null, selected.id)} />
            </div>

            <section className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Stay</h3>
              {selected.stay ? (
                <Link href={`/dashboard/reservations?res=${selected.stay.id}`} className="block rounded-xl border border-line p-3 text-sm hover:bg-subtle">
                  <p className="font-semibold">{selected.stay.guest}</p>
                  <p className="text-muted">
                    {fmtDate(selected.stay.check_in)} – {fmtDate(selected.stay.check_out)} · {selected.stay.status === "checked_in" ? "In house" : "Arriving"}
                  </p>
                </Link>
              ) : (
                <p className="text-sm text-muted">No guest.</p>
              )}
            </section>

            <section className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Requests, last 7 days</h3>
              {history.length ? (
                <ul className="space-y-1.5">
                  {history.map((h) => (
                    <li key={h.id}>
                      <Link href={`/dashboard/requests?r=${h.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-subtle">
                        <span className="w-24 shrink-0 text-xs text-muted tabular-nums">
                          {fmtDate(h.created_at, hotel.timezone)} {fmtTime(h.created_at, hotel.timezone)}
                        </span>
                        <span className="flex-1 truncate">{h.title}</span>
                        <StatusChip status={h.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No requests this week.</p>
              )}
              {history.filter((h) => h.service?.category === "maintenance").length >= 2 ? (
                <p className="mt-3 rounded-xl bg-progress-bg px-3 py-2 text-sm text-progress">Repeat maintenance requests: possible recurring fault.</p>
              ) : null}
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
