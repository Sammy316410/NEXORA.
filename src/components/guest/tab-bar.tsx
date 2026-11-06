"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedDouble, House, ListTodo } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/guest", label: "Home", icon: House, match: (p: string) => p === "/guest" || p.startsWith("/guest/request/") || p === "/guest/request" || p === "/guest/describe" },
  { href: "/guest/requests", label: "My requests", icon: ListTodo, match: (p: string) => p.startsWith("/guest/requests") },
  { href: "/guest/stay", label: "Stay", icon: BedDouble, match: (p: string) => p.startsWith("/guest/stay") },
];

export function GuestTabBar({ openCount }: { openCount: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Guest portal"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="grid grid-cols-3">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium", active ? "text-hotel" : "text-muted")}
              >
                <span className="relative">
                  <Icon className="size-6" strokeWidth={active ? 2.2 : 1.75} aria-hidden="true" />
                  {tab.href === "/guest/requests" && openCount > 0 ? (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-hotel px-1 text-center text-[10px] leading-4 font-bold text-white">
                      {openCount}
                    </span>
                  ) : null}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
