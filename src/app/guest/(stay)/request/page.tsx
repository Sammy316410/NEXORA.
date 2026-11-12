import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { listServices } from "@/lib/hotel";
import { ServiceIcon } from "@/components/icons";
import type { ServiceCategory } from "@/lib/types";

export const metadata: Metadata = { title: "Request a service" };

const CATEGORY_TITLES: Record<ServiceCategory, string> = {
  amenities: "Amenities",
  housekeeping: "Housekeeping",
  maintenance: "Something needs fixing",
  food: "Food and drinks",
  front_desk: "Front desk help",
};

// G3 step 1: pick a service (skipped when the guest came from a home tile).
export default async function ChooseServicePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const { hotel } = await requireGuest();
  const services = await listServices(hotel.id, { guestVisibleOnly: true });
  const categories = (Object.keys(CATEGORY_TITLES) as ServiceCategory[]).filter((c) => !category || c === category);

  return (
    <div>
      <Link href="/guest" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted">
        <ChevronLeft className="size-4" aria-hidden="true" /> Back
      </Link>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">
        {category ? CATEGORY_TITLES[category as ServiceCategory] ?? "Request a service" : "Request a service"}
      </h1>
      <div className="mt-5 space-y-6">
        {categories.map((c) => {
          const list = services.filter((s) => s.category === c);
          if (!list.length) return null;
          return (
            <section key={c}>
              {!category ? <h2 className="mb-2 text-sm font-semibold text-muted">{CATEGORY_TITLES[c]}</h2> : null}
              <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
                {list.map((s) => (
                  <li key={s.id} className="border-b border-line last:border-b-0">
                    <Link href={`/guest/request/${s.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-subtle">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-hotel/10 text-hotel">
                        <ServiceIcon icon={s.icon} className="size-5" />
                      </span>
                      <span className="flex-1 text-[15px] font-semibold">{s.name}</span>
                      <ChevronRight className="size-5 text-muted" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <Link href="/guest/describe" className="mt-6 block text-center text-sm font-medium text-hotel">
        Can&apos;t find it? Describe it in your own words
      </Link>
    </div>
  );
}
