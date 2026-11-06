import type { Metadata } from "next";
import { requireManager } from "@/lib/auth";
import { getHotel, listStaff } from "@/lib/hotel";
import { listRequests } from "@/lib/requests";
import { dayStart } from "@/lib/stats";
import { average, clocks, OPEN_STATUSES } from "@/lib/sla";
import { DEPARTMENT_LABEL, ROLE_LABEL } from "@/lib/labels";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar, Card, PageTitle } from "@/components/ui";
import { WorkpegMark } from "@/components/brand";

export const metadata: Metadata = { title: "Staff" };

// M10: who's on, what they're carrying, how fast they finish.
export default async function StaffPage() {
  await requireManager();
  const hotel = await getHotel();
  const [staff, open, today, week] = await Promise.all([
    listStaff(hotel.id),
    listRequests({ hotelId: hotel.id, statuses: OPEN_STATUSES, limit: 500 }),
    listRequests({ hotelId: hotel.id, statuses: ["completed"], since: new Date(dayStart(hotel.timezone)).toISOString(), limit: 500 }),
    listRequests({ hotelId: hotel.id, since: new Date(dayStart(hotel.timezone, -6)).toISOString(), limit: 1000 }),
  ]);

  const rows = staff
    .map((s) => {
      const mine = week.filter((r) => r.assignee_id === s.id && r.status === "completed");
      const rated = mine.filter((r) => r.guest_feedback);
      return {
        s,
        open: open.filter((r) => r.assignee_id === s.id).length,
        doneToday: today.filter((r) => r.assignee_id === s.id).length,
        avg: average(mine.map((r) => clocks(r).resolution)),
        up: rated.length ? Math.round((rated.filter((r) => r.guest_feedback === "up").length / rated.length) * 100) : null,
      };
    })
    .sort((a, b) => Number(b.s.on_duty) - Number(a.s.on_duty) || (a.s.department_id ?? "").localeCompare(b.s.department_id ?? ""));

  return (
    <div>
      <PageTitle title="Staff" subtitle={`${staff.filter((s) => s.on_duty).length} of ${staff.length} on duty. Only on-duty staff are offered for assignment.`} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              {["Name", "Department", "Role", "Status", "Open tasks", "Done today", "Avg time to done (7 d)", "Thumbs up (7 d)"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, open: o, doneToday, avg, up }) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={s.full_name} />
                    <span>
                      <span className="block font-semibold">{s.full_name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted">
                        {s.email}
                        {s.workpeg_subject ? <WorkpegMark onDark={false} className="size-3" /> : null}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5">{DEPARTMENT_LABEL[s.department_id ?? ""] ?? "Management"}</td>
                <td className="px-4 py-2.5">{s.job_title ?? ROLE_LABEL[s.role]}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", s.on_duty ? "bg-done-bg text-done" : "bg-neutral-bg text-neutral")}>
                    <span className={cn("size-1.5 rounded-full", s.on_duty ? "bg-done" : "bg-neutral")} aria-hidden="true" />
                    {s.on_duty ? "On duty" : "Off duty"}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-semibold tabular-nums">{o}</td>
                <td className="px-4 py-2.5 tabular-nums">{doneToday}</td>
                <td className="px-4 py-2.5 tabular-nums">{avg === null ? "—" : fmtDuration(avg)}</td>
                <td className="px-4 py-2.5 tabular-nums">{up === null ? "—" : `${up}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
