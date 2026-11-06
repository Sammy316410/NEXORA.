import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

// ---------------------------------------------------------------------------
// Buttons

const VARIANTS = {
  primary: "bg-ink text-white hover:bg-ink-soft",
  accent: "bg-accent text-white hover:bg-accent-hover",
  hotel: "bg-hotel text-white hover:brightness-110",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-subtle",
  ghost: "text-ink hover:bg-black/5",
  danger: "border border-alert/25 bg-surface text-alert hover:bg-alert-bg",
} as const;

const SIZES = {
  sm: "h-8 rounded-lg px-3 text-sm",
  md: "h-10 rounded-lg px-4 text-sm",
  lg: "h-12 rounded-xl px-5 text-[15px]",
  xl: "h-14 rounded-2xl px-6 text-base",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Surfaces

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div>
        <h2 className="font-display text-[15px] font-bold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "alert" | "dark";
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded-2xl border p-4 transition-colors",
        tone === "dark"
          ? "border-ink bg-ink text-white"
          : tone === "alert"
            ? "border-alert/25 bg-alert-bg"
            : "border-line bg-surface",
        href && "hover:border-line-strong",
      )}
    >
      <p className={cn("text-[13px] font-medium", tone === "dark" ? "text-white/70" : tone === "alert" ? "text-alert" : "text-muted")}>
        {label}
      </p>
      <p className={cn("mt-2 font-display text-[32px] leading-none font-extrabold tabular-nums", tone === "alert" && "text-alert")}>
        {value}
      </p>
      {sub ? (
        <p className={cn("mt-2 text-[13px]", tone === "dark" ? "text-white/70" : tone === "alert" ? "text-alert" : "text-muted")}>{sub}</p>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

// ---------------------------------------------------------------------------
// Forms

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-medium", className)} {...props} />;
}

const fieldBase =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted/80 focus-visible:border-accent";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 py-3", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldBase, "h-12 pr-8", className)} {...props} />;
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-alert-bg px-3.5 py-2.5 text-sm text-alert">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Bits

const AVATAR_TINTS = ["bg-[#E7F1FB]", "bg-[#EFEDFF]", "bg-[#E5F4E4]", "bg-[#F9EEDA]", "bg-[#F9ECE7]", "bg-[#F0EFEC]"];

export function Avatar({ name, size = "md", className }: { name: string | null | undefined; size?: "sm" | "md" | "lg"; className?: string }) {
  const label = name ?? "?";
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-ink",
        AVATAR_TINTS[hash % AVATAR_TINTS.length],
        size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-11 text-sm" : "size-8 text-xs",
        className,
      )}
    >
      {initials(label)}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-muted">{icon}</div> : null}
      <p className="font-display text-base font-bold">{title}</p>
      {children ? <div className="mt-1 max-w-xs text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-line", className)} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-line", className)} />;
}
