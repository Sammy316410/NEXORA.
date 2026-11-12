import type { Metadata } from "next";
import { requireManager } from "@/lib/auth";
import { getHotel, listRooms, listServices, listStaff } from "@/lib/hotel";
import { DEPARTMENT_LABEL } from "@/lib/labels";
import { logRequestAction } from "@/app/actions/manager";
import { Card, PageTitle } from "@/components/ui";
import { LogRequestForm } from "@/components/dashboard/log-request-form";

export const metadata: Metadata = { title: "Log a request" };

// M6: the front desk records a phone or walk-in request.
export default async function LogRequestPage() {
  await requireManager();
  const hotel = await getHotel();
  const [services, staff, rooms] = await Promise.all([listServices(hotel.id), listStaff(hotel.id), listRooms(hotel)]);

  return (
    <div>
      <PageTitle title="Log a request" subtitle="For requests that arrive by phone or at the desk." />
      <Card className="p-6">
        <LogRequestForm
          action={logRequestAction}
          services={services.map((s) => ({ id: s.id, name: s.name, category: s.category, hasQuantity: s.has_quantity, maxQuantity: s.max_quantity }))}
          staff={staff
            .filter((s) => s.on_duty && s.role !== "manager")
            .map((s) => ({ id: s.id, name: s.full_name, department: DEPARTMENT_LABEL[s.department_id ?? ""] ?? "Front desk" }))}
          occupied={rooms.filter((r) => r.stay?.status === "checked_in").map((r) => ({ number: r.number, guest: r.stay!.guest }))}
        />
      </Card>
    </div>
  );
}
