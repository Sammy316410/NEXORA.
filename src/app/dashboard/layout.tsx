import Link from "next/link";
import { LogOut, Plus, Search } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { getHotel } from "@/lib/hotel";
import { listRequests } from "@/lib/requests";
import { topics } from "@/lib/realtime";
import { OPEN_STATUSES } from "@/lib/sla";
import { ROLE_LABEL } from "@/lib/labels";
import { signOut } from "@/app/actions/staff";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Avatar, buttonClass } from "@/components/ui";
import { WorkpegMark } from "@/components/brand";
import { LiveRefresh } from "@/components/client/live-refresh";

// Manager dashboard shell: desktop first (1440 x 900), icon sidebar at tablet width.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const manager = await requireManager();
  const hotel = await getHotel();
  const open = await listRequests({ hotelId: hotel.id, statuses: OPEN_STATUSES, limit: 500 });

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar hotelName={hotel.name} openCount={open.length} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-line bg-canvas/90 px-6 backdrop-blur">
          <form action="/dashboard/requests" className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              name="q"
              type="search"
              placeholder="Search room, guest or NX code"
              aria-label="Search requests"
              className="h-10 w-full rounded-full border border-line bg-surface pr-4 pl-9 text-sm placeholder:text-muted"
            />
          </form>
          <div className="ml-auto flex items-center gap-4">
            <LiveRefresh topic={topics.hotel(hotel.id)} audience="dashboard" intervalMs={10000} />
            <Link href="/dashboard/requests/new" className={buttonClass("primary", "md", "rounded-full")}>
              <Plus className="size-4" aria-hidden="true" /> Log request
            </Link>
            <div className="flex items-center gap-2.5 border-l border-line pl-4">
              <Avatar name={manager.full_name} />
              <div className="hidden leading-tight xl:block">
                <p className="text-sm font-semibold">{manager.full_name}</p>
                <p className="flex items-center gap-1 text-xs text-muted">
                  {manager.job_title ?? ROLE_LABEL[manager.role]}
                  {manager.workpeg_subject ? (
                    <>
                      {" · "}
                      <WorkpegMark onDark={false} className="size-3" /> via Workpeg
                    </>
                  ) : null}
                </p>
              </div>
              <form action={signOut}>
                <button type="submit" title="Sign out" className="rounded-full p-2 text-muted hover:bg-black/5 hover:text-ink">
                  <LogOut className="size-4" aria-hidden="true" />
                  <span className="sr-only">Sign out</span>
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
