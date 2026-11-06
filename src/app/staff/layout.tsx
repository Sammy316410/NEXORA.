import { requireStaff } from "@/lib/auth";
import { listRequests } from "@/lib/requests";
import { topics } from "@/lib/realtime";
import { StaffTabBar } from "@/components/staff/tab-bar";
import { LiveRefresh } from "@/components/client/live-refresh";

// Staff app shell: a one-handed task list, built at 360 x 800 first.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const pool = staff.department_id
    ? await listRequests({ hotelId: staff.hotel_id, statuses: ["pending"], departmentId: staff.department_id, limit: 50 })
    : [];

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="relative mx-auto min-h-dvh max-w-[480px] bg-canvas pb-24">
        {children}
        <div className="absolute top-5 right-4 z-20 rounded-full bg-surface/90 px-2.5 py-1 shadow-card backdrop-blur">
          <LiveRefresh topic={topics.hotel(staff.hotel_id)} audience="staff" staffId={staff.id} departmentId={staff.department_id} intervalMs={7000} />
        </div>
      </div>
      <StaffTabBar poolCount={pool.filter((r) => !r.assignee_id).length} />
    </div>
  );
}
