import { listRequests } from "@/lib/requests";
import { dayStart } from "@/lib/stats";
import { getHotel } from "@/lib/hotel";
import { mobile, requireMobileStaff } from "@/lib/mobile-auth";
import { mobileTask, sortTasks } from "@/lib/mobile-view";

// GET: the signed-in staff member's lists — To do, In progress, Done today — and the
// open pool for their department. Same rules as /staff and /staff/pool.
export async function GET(req: Request) {
  return mobile(async () => {
    const staff = await requireMobileStaff(req);
    const hotel = await getHotel();
    const now = Date.now();
    const [mine, poolRows] = await Promise.all([
      listRequests({ hotelId: staff.hotel_id, assigneeId: staff.id, limit: 200 }),
      staff.department_id
        ? listRequests({ hotelId: staff.hotel_id, statuses: ["pending"], departmentId: staff.department_id, limit: 50 })
        : Promise.resolve([]),
    ]);
    const since = dayStart(hotel.timezone, 0, now);
    const sort = (a: (typeof mine)[number], b: (typeof mine)[number]) => sortTasks(a, b, now);

    return {
      staff: { id: staff.id, name: staff.full_name, departmentId: staff.department_id, role: staff.role, onDuty: staff.on_duty },
      todo: mine.filter((r) => r.status === "assigned").sort(sort).map((r) => mobileTask(r, now)),
      doing: mine.filter((r) => r.status === "in_progress").sort(sort).map((r) => mobileTask(r, now)),
      done: mine
        .filter((r) => r.status === "completed" && r.completed_at && Date.parse(r.completed_at) >= since)
        .map((r) => mobileTask(r, now)),
      pool: poolRows.filter((r) => !r.assignee_id).map((r) => mobileTask(r, now)),
    };
  });
}
