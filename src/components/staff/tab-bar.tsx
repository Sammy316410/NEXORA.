"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser, Inbox, ListTodo } from "lucide-react";
import { cn } from "@/lib/cn";

export function StaffTabBar({ poolCount }: { poolCount: number }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/staff", label: "Tasks", icon: ListTodo, active: pathname === "/staff" || pathname.startsWith("/staff/tasks") },
    { href: "/staff/pool", label: "Open pool", icon: Inbox, active: pathname.startsWith("/staff/pool"), badge: poolCount },
    { href: "/staff/profile", label: "Profile", icon: CircleUser, active: pathname.startsWith("/staff/profile") },
  ];
  return (
    <nav aria-label="Staff" className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-3">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={t.active ? "page" : undefined}
                className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium", t.active ? "text-ink" : "text-muted")}
              >
                <span className="relative">
                  <Icon className="size-6" strokeWidth={t.active ? 2.2 : 1.75} aria-hidden="true" />
                  {t.badge ? (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-bold text-white">
                      {t.badge}
                    </span>
                  ) : null}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
