import type { Metadata } from "next";
import { requireManager } from "@/lib/auth";
import { getHotel, listServices } from "@/lib/hotel";
import { DEPARTMENT_LABEL } from "@/lib/labels";
import { Card, PageTitle } from "@/components/ui";
import { ServiceIcon } from "@/components/icons";
import { PriorityBadge } from "@/components/status";

export const metadata: Metadata = { title: "Services and SLAs" };

// M12: the service catalogue and its targets (read-only in the MVP).
export default async function ServicesPage() {
  await requireManager();
  const hotel = await getHotel();
  const services = await listServices(hotel.id);

  return (
    <div>
      <PageTitle
        title="Services and SLAs"
        subtitle="What guests can ask for, who handles it, and the targets behind every due time. Urgent requests are due within 30 minutes."
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              {["Service", "Department", "Default priority", "Response target", "Resolution target", "Guest can ask", "Quantity"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 font-medium">
                    <ServiceIcon icon={s.icon} className="size-4 text-muted" /> {s.name}
                  </span>
                </td>
                <td className="px-4 py-2.5">{DEPARTMENT_LABEL[s.department_id]}</td>
                <td className="px-4 py-2.5">
                  <PriorityBadge priority={s.default_priority} />
                </td>
                <td className="px-4 py-2.5 tabular-nums">{s.response_target_min} min</td>
                <td className="px-4 py-2.5 tabular-nums">{s.resolution_target_min} min</td>
                <td className="px-4 py-2.5">{s.guest_visible ? "Yes" : "Staff and AI only"}</td>
                <td className="px-4 py-2.5">{s.has_quantity ? `Up to ${s.max_quantity}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted">Response = sent → started. Resolution = sent → done. Defaults follow the industry pattern of 10 and 30 minutes, tuned per service.</p>
    </div>
  );
}
