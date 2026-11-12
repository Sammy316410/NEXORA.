import { cn } from "@/lib/cn";

/** Status mix donut with the total in the middle (status colours, labelled legend). */
export function StatusDonut({
  segments,
  total,
  label,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  label: string;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  const arcs = segments.map((s, i) => ({
    s,
    len: (s.value / sum) * c,
    offset: segments.slice(0, i).reduce((a, prev) => a + (prev.value / sum) * c, 0),
  }));
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="size-36 shrink-0" role="img" aria-label={`${label}: ${total}`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-line)" strokeWidth="18" />
        {arcs.map(({ s, len, offset }) =>
          s.value > 0 ? (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeDasharray={`${Math.max(len - 2, 0)} ${c}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          ) : null,
        )}
        <text x="70" y="70" textAnchor="middle" className="fill-ink font-display text-[28px] font-extrabold" dominantBaseline="central">
          {total}
        </text>
        <text x="70" y="96" textAnchor="middle" className="fill-muted text-[10px]">
          {label}
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            <span className="text-muted">{s.label}</span>
            <span className="ml-auto pl-4 font-semibold tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One horizontal stacked bar per department, split by status. */
export function WorkloadBars({
  rows,
}: {
  rows: { name: string; pending: number; assigned: number; inProgress: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.pending + r.assigned + r.inProgress));
  return (
    <div className="space-y-3.5">
      {rows.map((r) => {
        const total = r.pending + r.assigned + r.inProgress;
        return (
          <div key={r.name}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">{r.name}</span>
              <span className="font-semibold tabular-nums">{total}</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`${r.name}: ${r.pending} pending, ${r.assigned} assigned, ${r.inProgress} in progress`}>
              {[
                { v: r.pending, c: "bg-pending" },
                { v: r.assigned, c: "bg-assigned" },
                { v: r.inProgress, c: "bg-[#E59A1A]" },
              ].map((seg, i) =>
                seg.v ? <span key={i} className={cn("h-full", seg.c)} style={{ width: `${(seg.v / max) * 100}%` }} /> : null,
              )}
            </div>
          </div>
        );
      })}
      <div className="flex gap-4 pt-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-pending" />Pending</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-assigned" />Assigned</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#E59A1A]" />In progress</span>
      </div>
    </div>
  );
}

/** Seven-day columns: requests created (light) with completed overlaid (dark). Labels on bars. */
export function WeekColumns({ days }: { days: { label: string; created: number; completed: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.created));
  return (
    <div className="flex h-48 items-end gap-3" role="img" aria-label="Requests per day, last 7 days">
      {days.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-xs font-semibold tabular-nums">{d.created}</span>
          <div className="relative flex h-36 w-full max-w-12 items-end overflow-hidden rounded-lg bg-line/60">
            <span className="w-full rounded-lg bg-[#BFD4FF]" style={{ height: `${(d.created / max) * 100}%` }} />
            <span className="absolute bottom-0 w-full rounded-lg bg-accent" style={{ height: `${(d.completed / max) * 100}%` }} />
          </div>
          <span className={cn("text-xs", i === days.length - 1 ? "font-semibold text-ink" : "text-muted")}>{i === days.length - 1 ? "Today" : d.label}</span>
        </div>
      ))}
    </div>
  );
}
