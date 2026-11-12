import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { getService } from "@/lib/hotel";
import { submitRequest } from "@/app/actions/guest";
import { ServiceIcon } from "@/components/icons";
import { RequestForm } from "@/components/guest/request-form";

export const metadata: Metadata = { title: "Request" };

// G3 step 2: quantity, note, urgency, then send.
export default async function RequestDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<{ qty?: string; note?: string; ai?: string; engine?: string; prio?: string }>;
}) {
  const [{ serviceId }, sp] = await Promise.all([params, searchParams]);
  const { hotel, room } = await requireGuest();
  const service = await getService(serviceId);
  if (!service || service.hotel_id !== hotel.id || !service.active) notFound();

  return (
    <div>
      <Link href={`/guest/request?category=${service.category}`} className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted">
        <ChevronLeft className="size-4" aria-hidden="true" /> Back
      </Link>
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-hotel/10 text-hotel">
          <ServiceIcon icon={service.icon} className="size-7" />
        </span>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{service.name}</h1>
      </div>
      <RequestForm
        action={submitRequest}
        roomNumber={room.number}
        service={{
          id: service.id,
          name: service.name,
          hasQuantity: service.has_quantity,
          maxQuantity: service.max_quantity,
          askUrgent: service.ask_urgent,
          needsNote: service.needs_note,
          resolutionTargetMin: service.resolution_target_min,
          category: service.category,
        }}
        prefill={{
          quantity: sp.qty ? Number(sp.qty) : undefined,
          note: sp.note?.slice(0, 500),
          aiConfidence: sp.ai,
          aiEngine: sp.engine,
          aiPriority: sp.prio,
        }}
      />
    </div>
  );
}
