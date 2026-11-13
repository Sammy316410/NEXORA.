"use client";

import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck, Sparkles, Wrench, BedDouble, ConciergeBell, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/cn";

type Scenario = {
  room: string;
  guest: string;
  ask: string;
  title: string;
  dept: string;
  icon: typeof BedDouble;
  priority: "Normal" | "High";
  staff: string;
  role: string;
  code: string;
  minutes: number;
};

const SCENARIOS: Scenario[] = [
  { room: "204", guest: "David", ask: "Hi, could we get two more towels please?", title: "Extra towels ×2", dept: "Housekeeping", icon: BedDouble, priority: "Normal", staff: "Amaka", role: "Housekeeping", code: "NX-1042", minutes: 9 },
  { room: "311", guest: "Funke", ask: "The AC isn't cooling at all and it's really hot.", title: "AC not cooling", dept: "Maintenance", icon: Wrench, priority: "High", staff: "Tunde", role: "Maintenance", code: "NX-1043", minutes: 14 },
  { room: "118", guest: "Kofi", ask: "Can I get jollof rice and a chapman sent up?", title: "Room service order", dept: "Food & drink", icon: UtensilsCrossed, priority: "Normal", staff: "Chidi", role: "Kitchen", code: "NX-1044", minutes: 22 },
  { room: "407", guest: "Sade", ask: "Is a 1pm late checkout possible tomorrow?", title: "Late checkout 1pm", dept: "Front desk", icon: ConciergeBell, priority: "Normal", staff: "Grace", role: "Front desk", code: "NX-1045", minutes: 4 },
];

export const STEPS = ["Guest asks", "AI sorts it", "Desk assigns", "Staff starts", "Done & guest told"] as const;
const STEP_MS = 1900;

/** The landing page's live walkthrough: one request, three screens, five beats. */
export function LiveFlow() {
  const [i, setI] = useState(0);
  // Start on the finished frame: it's what renders without JS or with reduced motion.
  const [step, setStep] = useState(4);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setStep((s) => {
        if (s >= STEPS.length) {
          setI((n) => (n + 1) % SCENARIOS.length);
          return 0;
        }
        return s + 1;
      });
    }, STEP_MS);
    return () => clearInterval(t);
  }, []);

  const s = SCENARIOS[i];
  const at = Math.min(step, 4);
  const Icon = s.icon;
  const status = at >= 4 ? "Done" : at >= 3 ? "In progress" : at >= 2 ? "Assigned" : "New";
  const statusTone =
    at >= 4 ? "bg-emerald-400/15 text-emerald-300" : at >= 3 ? "bg-amber-400/15 text-amber-300" : at >= 2 ? "bg-blue-400/15 text-blue-300" : "bg-violet-400/15 text-violet-300";

  return (
    <div className="relative">
      {/* progress rail */}
      <ol className="mx-auto mb-8 grid max-w-3xl grid-cols-5 gap-2" aria-label="How one request moves">
        {STEPS.map((label, n) => (
          <li key={label} className="flex flex-col items-center gap-2 text-center">
            <span className={cn("h-1 w-full rounded-full bg-white/10 transition-colors duration-500", n <= at && "bg-accent")} />
            <span className={cn("text-[11px] font-medium transition-colors duration-500 sm:text-xs", n <= at ? "text-white" : "text-white/40")}>{label}</span>
          </li>
        ))}
      </ol>

      <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.35fr_1fr]">
        {/* Guest phone */}
        <Phone label="Guest · Room portal" tint="from-teal-500/20">
          <p className="text-[11px] font-semibold tracking-wider text-teal-300 uppercase">Amber Coast · Room {s.room}</p>
          <p className="mt-1 font-display text-lg font-extrabold text-white">Hi {s.guest} 👋</p>
          <div className="mt-4 flex justify-end">
            <p key={`ask-${i}`} className="max-w-[85%] animate-rise rounded-2xl rounded-br-md bg-teal-500 px-3 py-2 text-[13px] leading-snug text-white">
              {s.ask}
            </p>
          </div>
          <div className={cn("mt-3 transition-all duration-500", at >= 1 ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0")}>
            <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-white/10 px-3 py-2 text-[13px] leading-snug text-white/90">
              Got it! {s.dept} is on it. Ref {s.code}.
            </p>
          </div>
          <div className={cn("mt-3 transition-all duration-500", at >= 4 ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0")}>
            <p className="flex max-w-[90%] items-center gap-1.5 rounded-2xl rounded-bl-md bg-emerald-500/20 px-3 py-2 text-[13px] text-emerald-200">
              <CheckCheck className="size-4 shrink-0" aria-hidden="true" /> Done in {s.minutes} min. Enjoy!
            </p>
          </div>
        </Phone>

        {/* Control room */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111214] shadow-2xl shadow-black/50">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="ml-3 text-xs text-white/40">nexora · control room</span>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
              <span className="size-1.5 animate-pulse-soft rounded-full bg-emerald-400" /> Live
            </span>
          </div>
          <div className="p-4">
            <div className={cn("flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-blue-200 transition-all duration-500", at >= 1 ? "opacity-100" : "opacity-0")}>
              <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                AI read “{s.ask.slice(0, 26)}…” → <b className="text-white">{s.dept}</b> · {s.priority}
              </span>
            </div>
            <div key={`row-${i}`} className={cn("mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-all duration-500", at >= 1 ? "opacity-100" : "opacity-40")}>
              <div className="flex items-start gap-3">
                <div className="font-display text-2xl leading-none font-extrabold text-white tabular-nums">{s.room}</div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    <Icon className="size-4 text-white/60" aria-hidden="true" /> {s.title}
                  </p>
                  <p className="text-[11px] text-white/40">
                    {s.code} · {s.guest} · {s.dept}
                  </p>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors duration-500", statusTone)}>{status}</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-[11px] text-white/40">Assigned to</span>
                <span className={cn("flex items-center gap-2 text-xs font-medium transition-all duration-500", at >= 2 ? "text-white opacity-100" : "opacity-0")}>
                  <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold">{s.staff[0]}</span>
                  {s.staff} · {s.role}
                </span>
              </div>
            </div>
            {/* quiet background rows so it reads as a real board */}
            {[
              ["302", "Extra pillows", "Done", "bg-emerald-400/15 text-emerald-300"],
              ["115", "Shower drain slow", "Assigned", "bg-blue-400/15 text-blue-300"],
            ].map(([room, title, st, tone]) => (
              <div key={room} className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2 opacity-50">
                <span className="w-8 font-display text-sm font-extrabold text-white tabular-nums">{room}</span>
                <span className="flex-1 text-xs text-white/70">{title}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tone)}>{st}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Staff phone */}
        <Phone label={`Staff app · ${s.staff}`} tint="from-blue-500/20">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-extrabold text-white">Hi {s.staff}</p>
            <Bell className={cn("size-4 text-white/40 transition-all", at === 2 && "animate-[wiggle_0.5s_ease-in-out_2] text-amber-300")} aria-hidden="true" />
          </div>
          <div className={cn("mt-3 rounded-2xl bg-white p-3 text-ink transition-all duration-500", at >= 2 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>
            <p className="text-[10px] font-semibold tracking-wider text-muted uppercase">Room</p>
            <p className="font-display text-3xl leading-none font-extrabold tabular-nums">{s.room}</p>
            <p className="mt-1 text-sm font-semibold">{s.title}</p>
            <div
              className={cn(
                "mt-3 flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white transition-colors duration-500",
                at >= 4 ? "bg-emerald-600" : at >= 3 ? "bg-accent" : "bg-ink",
              )}
            >
              {at >= 4 ? (
                <>
                  <Check className="size-4" aria-hidden="true" /> Completed
                </>
              ) : at >= 3 ? (
                "Mark complete"
              ) : (
                "Start task"
              )}
            </div>
          </div>
          <p className={cn("mt-3 text-center text-[11px] text-white/40 transition-opacity", at >= 2 ? "opacity-0" : "opacity-100")}>No tasks yet…</p>
        </Phone>
      </div>
    </div>
  );
}

function Phone({ label, tint, children }: { label: string; tint: string; children: React.ReactNode }) {
  return (
    <figure className="mx-auto w-full max-w-[260px]">
      <div className={cn("relative h-[380px] overflow-hidden rounded-[2.2rem] border border-white/15 bg-gradient-to-b to-[#0b0b0c] p-2 shadow-2xl shadow-black/60", tint)}>
        <div className="h-full rounded-[1.8rem] bg-[#0b0b0c]/90 px-4 pt-8 pb-4">
          <span className="absolute top-3.5 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/15" />
          {children}
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-white/50">{label}</figcaption>
    </figure>
  );
}
