"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedSingle, CalendarDays, ChartColumn, CreditCard, Inbox, LayoutDashboard, Plug, Settings, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { NexoraMark } from "@/components/brand";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/requests", label: "Requests", icon: Inbox, badge: true },
  { href: "/dashboard/rooms", label: "Rooms", icon: BedSingle },
  { href: "/dashboard/reservations", label: "Reservations", icon: CalendarDays },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/insights", label: "Insights", icon: ChartColumn },
];

const SETTINGS = [
  { href: "/dashboard/settings", label: "Services and SLAs", icon: Settings, exact: true },
  { href: "/dashboard/settings/integrations", label: "Integrations", icon: Plug },
];

export function Sidebar({ hotelName, openCount }: { hotelName: string; openCount: number }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  const item = (n: { href: string; label: string; icon: typeof Inbox; exact?: boolean; badge?: boolean }) => {
    const active = isActive(n.href, n.exact);
    const Icon = n.icon;
    return (
      <li key={n.href}>
        <Link
          href={n.href}
          aria-current={active ? "page" : undefined}
          title={n.label}
          className={cn(
            "flex h-10 items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors max-lg:justify-center max-lg:px-0",
            active ? "bg-ink text-white" : "text-muted hover:bg-black/5 hover:text-ink",
          )}
        >
          <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
          <span className="flex-1 max-lg:sr-only">{n.label}</span>
          {n.badge && openCount > 0 ? (
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] leading-5 font-bold tabular-nums max-lg:hidden",
                active ? "bg-white/20 text-white" : "bg-accent text-white",
              )}
            >
              {openCount}
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <aside className="sticky top-0 flex h-dvh w-[72px] shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:w-[248px] lg:px-4">
      <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-1 max-lg:justify-center">
        <NexoraMark className="size-9" />
        <span className="leading-tight max-lg:hidden">
          <span className="block font-display text-[15px] font-extrabold tracking-[0.08em]">NEXORA</span>
          <span className="block text-xs text-muted">{hotelName}</span>
        </span>
      </Link>
      <nav aria-label="Dashboard" className="flex flex-1 flex-col">
        <ul className="space-y-1">{NAV.map(item)}</ul>
        <p className="mt-8 mb-2 px-3 text-[11px] font-semibold tracking-wide text-muted uppercase max-lg:sr-only">Settings</p>
        <ul className="space-y-1 max-lg:mt-6">{SETTINGS.map(item)}</ul>
      </nav>
    </aside>
  );
}
