import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BedDouble,
  BellRing,
  ConciergeBell,
  CreditCard,
  Hand,
  LayoutDashboard,
  MessageSquareDashed,
  QrCode,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Timer,
  UtensilsCrossed,
  Wine,
  Wrench,
} from "lucide-react";
import { NexoraLogo, NexoraMark, WorkpegMark } from "@/components/brand";
import { LiveFlow } from "@/components/landing/live-flow";
import { cn } from "@/lib/cn";

export const metadata = {
  title: { absolute: "NEXORA · Every guest request, accounted for" },
  description:
    "NEXORA connects guests, staff and managers on one live request. Guests ask from their phone, AI routes it, the desk assigns in one tap and staff close it out. Native to Workpeg.",
};

const TICKER = [
  ["204", "Extra towels ×2"],
  ["311", "AC not cooling"],
  ["118", "Jollof rice & chapman"],
  ["407", "Late checkout 1pm"],
  ["115", "Shower drain slow"],
  ["302", "Extra pillows"],
  ["220", "Iron & board"],
  ["509", "Wi-Fi password"],
  ["126", "Wake-up call 6am"],
  ["333", "TV remote not working"],
  ["210", "Airport taxi 5pm"],
  ["404", "Turn-down service"],
];

export default function LandingPage() {
  return (
    <div className="bg-canvas text-ink">
      <Nav />
      <Hero />
      <Ticker />
      <Problem />
      <HowItWorks />
      <Features />
      <WorkpegSection />
      <Beyond />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-ink/70 px-4 py-2.5 backdrop-blur-xl sm:mx-4 lg:mx-auto">
        <Link href="/" aria-label="NEXORA home">
          <NexoraLogo inverted className="[&_svg]:size-7" />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex" aria-label="Main">
          <a href="#how" className="transition hover:text-white">How it works</a>
          <a href="#features" className="transition hover:text-white">Features</a>
          <a href="#workpeg" className="transition hover:text-white">Workpeg AI</a>
          <a href="#beyond" className="transition hover:text-white">Beyond hotels</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden rounded-xl px-3 py-2 text-sm font-medium text-white/70 transition hover:text-white sm:block">
            Sign in
          </Link>
          <Link href="/demo" className="group inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-white/90">
            Live demo <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink pt-36 pb-24 text-white sm:pt-44">
      {/* backdrop: grid, glow, drifting nodes */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)] bg-[size:56px_56px]" />
      <div aria-hidden="true" className="absolute top-[-20%] left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 animate-glow rounded-full bg-[radial-gradient(closest-side,rgb(0_100_255/0.45),transparent)] blur-2xl" />
      <div aria-hidden="true" className="absolute top-40 left-[8%] -z-10 size-3 animate-drift rounded-full bg-accent shadow-[0_0_24px_8px_rgb(0_100_255/0.5)]" />
      <div aria-hidden="true" className="absolute top-72 right-[10%] -z-10 size-2 animate-drift rounded-full bg-white/80 shadow-[0_0_20px_6px_rgb(255_255_255/0.3)] [animation-delay:-3s]" />
      <div aria-hidden="true" className="absolute top-[30rem] left-[18%] -z-10 size-2 animate-drift rounded-full bg-teal-300/80 shadow-[0_0_20px_6px_rgb(45_212_191/0.3)] [animation-delay:-6s]" />

      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-4xl text-center">
          <Link
            href="#workpeg"
            className="inline-flex max-w-full animate-rise items-center gap-2 rounded-2xl border border-white/15 bg-white/5 py-1 pr-3 pl-1 text-left text-xs text-white/80 backdrop-blur transition hover:border-white/30 sm:rounded-full"
          >
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2 py-0.5 font-semibold whitespace-nowrap text-ink">
              <WorkpegMark onDark={false} className="size-3.5" /> Native to Workpeg
            </span>
            <span className="leading-snug">Ask Workpeg AI for your shift handover</span>
            <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
          </Link>

          <h1 className="mt-7 font-display text-[2.75rem] leading-[0.98] font-extrabold tracking-tight text-balance sm:text-7xl lg:text-[5.5rem]">
            Every guest request,{" "}
            <span className="relative whitespace-nowrap">
              <span className="bg-gradient-to-r from-white via-blue-200 to-accent bg-clip-text text-transparent">accounted for.</span>
              <svg aria-hidden="true" viewBox="0 0 300 12" className="absolute -bottom-2 left-0 w-full text-accent" preserveAspectRatio="none">
                <path d="M2 9C60 3 140 2 298 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="animate-draw [stroke-dasharray:320] [stroke-dashoffset:0]" />
              </svg>
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-pretty text-white/65 sm:text-xl">
            Guests ask from their phone. AI sends it to the right team. The desk assigns in one tap, staff close it out, and the guest is told it&apos;s done.{" "}
            <span className="text-white">One live request that everyone can see.</span>
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="group relative inline-flex h-13 items-center gap-2 overflow-hidden rounded-2xl bg-accent px-7 text-base font-semibold text-white shadow-[0_10px_40px_-8px_rgb(0_100_255/0.8)] transition hover:bg-accent-hover"
            >
              <span aria-hidden="true" className="absolute inset-0 -translate-x-full animate-shine bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              Try the live demo <ArrowRight className="size-5 transition group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <a href="#how" className="inline-flex h-13 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10">
              See how it works
            </a>
          </div>
          <p className="mt-4 text-xs text-white/40">No sign-up. Open it as a guest, a housekeeper or the front desk.</p>
        </div>

        <div className="mt-20">
          <LiveFlow />
        </div>

        <dl className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-4">
          {[
            ["0", "apps for guests to install"],
            ["1 tap", "to assign a request"],
            ["4 teams", "on one live board"],
            ["Live", "updates on every screen"],
          ].map(([v, l]) => (
            <div key={l} className="bg-ink px-5 py-6 text-center">
              <dt className="sr-only">{l}</dt>
              <dd className="font-display text-3xl font-extrabold tracking-tight">{v}</dd>
              <dd className="mt-1 text-xs text-white/50">{l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <section aria-label="Requests NEXORA handles" className="relative overflow-hidden border-y border-line bg-surface py-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-surface to-transparent" />
      <ul className="flex w-max animate-marquee gap-3">
        {items.map(([room, what], n) => (
          <li key={n} aria-hidden={n >= TICKER.length} className="flex items-center gap-2.5 rounded-full border border-line bg-canvas py-1.5 pr-4 pl-1.5 text-sm whitespace-nowrap">
            <span className="rounded-full bg-ink px-2.5 py-0.5 font-display text-xs font-extrabold text-white tabular-nums">{room}</span>
            {what}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHead({ eyebrow, title, sub, dark = false, center = false }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode; dark?: boolean; center?: boolean }) {
  return (
    <div className={cn("max-w-3xl", center && "mx-auto text-center")}>
      <p className={cn("text-sm font-semibold tracking-wide", dark ? "text-blue-300" : "text-accent")}>{eyebrow}</p>
      <h2 className={cn("mt-3 font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl", dark && "text-white")}>{title}</h2>
      {sub ? <p className={cn("mt-5 text-lg leading-relaxed text-pretty", dark ? "text-white/60" : "text-muted")}>{sub}</p> : null}
    </div>
  );
}

function Problem() {
  const pains = [
    {
      icon: MessageSquareDashed,
      title: "Requests get lost",
      body: "A guest calls reception. Reception messages the housekeeping WhatsApp group. Someone says “on it”. Then nobody follows up.",
    },
    {
      icon: Hand,
      title: "Nobody clearly owns it",
      body: "Was it Amaka or Bisi? Did maintenance ever see the leak? Without an owner, every request is everyone's job and so nobody's.",
    },
    {
      icon: Timer,
      title: "Managers find out last",
      body: "The first sign of a slow response is a one-star review. Nobody can see what's open, what's late or who is overloaded.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-28">
      <SectionHead
        eyebrow="The problem"
        title={
          <>
            Hospitality runs on WhatsApp groups, walkie-talkies and <span className="text-muted line-through decoration-alert-solid decoration-4">memory</span>.
          </>
        }
        sub="Guests don't remember the room. They remember the towels that never came."
      />
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {pains.map(({ icon: Icon, title, body }) => (
          <article key={title} className="group rounded-3xl border border-line bg-surface p-7 transition duration-300 hover:-translate-y-1 hover:shadow-float">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-alert-bg text-alert transition group-hover:scale-110">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <h3 className="mt-6 font-display text-xl font-extrabold">{title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      who: "The guest",
      icon: QrCode,
      tone: "bg-teal-600",
      title: "Scans the room card. Asks in plain words.",
      body: "No app, no login, no hold music. Type “the AC isn't cooling” or tap Extra towels. They see the request move until it's done.",
    },
    {
      n: "02",
      who: "The front desk",
      icon: LayoutDashboard,
      tone: "bg-ink",
      title: "Sees it land, already sorted. Assigns in one tap.",
      body: "AI reads the message and picks the department and priority. The board shows what's new, what's late and who is free.",
    },
    {
      n: "03",
      who: "The staff member",
      icon: Smartphone,
      tone: "bg-accent",
      title: "Gets a buzz. Starts. Completes. Done.",
      body: "A one-handed phone app with big buttons. Claim from the open pool, add a note, or hand it back with a reason.",
    },
  ];
  return (
    <section id="how" className="scroll-mt-24 border-y border-line bg-surface py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead eyebrow="How it works" title="Three people. One live request." sub="Everyone looks at the same record, so nothing is lost when a request passes from one person to the next." center />
        <ol className="relative mt-16 grid gap-14 lg:grid-cols-3 lg:gap-6">
          <span aria-hidden="true" className="absolute top-10 right-[16%] left-[16%] hidden h-px bg-[linear-gradient(to_right,var(--color-line-strong)_50%,transparent_50%)] bg-[size:12px_1px] lg:block" />
          {steps.map(({ n, who, icon: Icon, tone, title, body }) => (
            <li key={n} className="relative flex flex-col items-center text-center">
              <span className={cn("relative flex size-20 items-center justify-center rounded-[1.6rem] text-white shadow-float ring-8 ring-surface", tone)}>
                <Icon className="size-8" aria-hidden="true" />
                <span className="absolute -top-2 -right-2 rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">{n}</span>
              </span>
              <p className="mt-6 text-sm font-semibold tracking-wide text-muted uppercase">{who}</p>
              <h3 className="mt-2 max-w-xs font-display text-2xl leading-tight font-extrabold">{title}</h3>
              <p className="mt-3 max-w-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-28">
      <SectionHead eyebrow="What's inside" title="Built for a busy shift." sub="Every screen is built for its job: the guest on a phone, the desk on a big screen, staff on the move." />
      <div className="mt-14 grid auto-rows-[minmax(220px,auto)] gap-5 md:grid-cols-6">
        {/* AI triage */}
        <article className="relative overflow-hidden rounded-3xl bg-ink p-8 text-white md:col-span-4">
          <div aria-hidden="true" className="absolute -top-24 -right-24 size-72 rounded-full bg-accent/30 blur-3xl" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-200">
            <Sparkles className="size-3.5" aria-hidden="true" /> AI triage
          </span>
          <h3 className="mt-5 max-w-md font-display text-3xl leading-tight font-extrabold">Guests write how they talk. NEXORA understands.</h3>
          <p className="mt-3 max-w-md text-white/60">Claude reads each message and fills in the department, priority and a clean title. If the AI is unavailable, keyword rules take over, so a request is never left unsorted.</p>
          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            {[
              ["“water dey drip from ceiling”", "Maintenance · High"],
              ["“abeg one more pillow”", "Housekeeping · Normal"],
            ].map(([q, a]) => (
              <div key={q} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
                <p className="text-white/80">{q}</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-blue-300">
                  <ArrowRight className="size-3.5" aria-hidden="true" /> {a}
                </p>
              </div>
            ))}
          </div>
        </article>

        {/* Live */}
        <article className="rounded-3xl border border-line bg-surface p-8 md:col-span-2">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-done-bg text-done">
            <Radio className="size-6" aria-hidden="true" />
          </span>
          <h3 className="mt-6 font-display text-2xl font-extrabold">Live on every screen</h3>
          <p className="mt-2 text-muted">Assign at the desk and the staff phone buzzes. Finish on the phone and the guest sees “Done”. Nobody refreshes.</p>
        </article>

        {/* SLA */}
        <article className="rounded-3xl border border-line bg-surface p-8 md:col-span-2">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-alert-bg text-alert">
            <BellRing className="size-6" aria-hidden="true" />
          </span>
          <h3 className="mt-6 font-display text-2xl font-extrabold">Late gets loud</h3>
          <p className="mt-2 text-muted">Every request has a due time. Overdue and urgent ones go to the top of Needs attention before a guest has to chase.</p>
        </article>

        {/* Payments */}
        <article className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-accent-subtle to-surface p-8 md:col-span-2">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-white">
            <CreditCard className="size-6" aria-hidden="true" />
          </span>
          <h3 className="mt-6 font-display text-2xl font-extrabold">Pay from the room</h3>
          <p className="mt-2 text-muted">Room service and extras get paid in the portal through Paystack checkout. Refunds show up on the manager&apos;s board.</p>
        </article>

        {/* Staff app */}
        <article className="rounded-3xl border border-line bg-surface p-8 md:col-span-2">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-assigned-bg text-assigned">
            <Smartphone className="size-6" aria-hidden="true" />
          </span>
          <h3 className="mt-6 font-display text-2xl font-extrabold">A staff app that fits in one hand</h3>
          <p className="mt-2 text-muted">To do, in progress, done. An open pool to claim work from. Off-duty mode, so nobody gets assigned on their day off.</p>
        </article>

        {/* Insights */}
        <article className="relative overflow-hidden rounded-3xl border border-line bg-surface p-8 md:col-span-6 lg:flex lg:items-center lg:gap-12">
          <div className="lg:max-w-sm">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-pending-bg text-pending">
              <BarChart3 className="size-6" aria-hidden="true" />
            </span>
            <h3 className="mt-6 font-display text-2xl font-extrabold">Know your shift at a glance</h3>
            <p className="mt-2 text-muted">Response times, open requests by department and who is carrying the load. Spot the slow floor before your guests do.</p>
          </div>
          <div aria-hidden="true" className="mt-8 flex h-40 flex-1 items-end gap-2 lg:mt-0">
            {[38, 62, 45, 80, 56, 92, 70, 48, 86, 64, 74, 98].map((h, n) => (
              <span
                key={n}
                style={{ height: `${h}%`, animationDelay: `${n * 70}ms` }}
                className={cn("flex-1 origin-bottom animate-grow rounded-t-lg", n === 11 ? "bg-accent" : "bg-ink/10")}
              />
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function WorkpegSection() {
  return (
    <section id="workpeg" className="relative isolate scroll-mt-24 overflow-hidden bg-ink py-28 text-white">
      <div aria-hidden="true" className="absolute bottom-[-30%] left-[-10%] -z-10 size-[600px] rounded-full bg-[radial-gradient(closest-side,rgb(0_100_255/0.3),transparent)] blur-2xl" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
        <div>
          <SectionHead
            dark
            eyebrow="Native to Workpeg"
            title={
              <>
                Ask your workspace.
                <br />
                NEXORA answers.
              </>
            }
            sub="NEXORA is installed as a Workpeg peg. Workpeg AI can read live requests, rooms and staff, and act on them, with a confirmation before anything changes."
          />
          <ul className="mt-8 space-y-3 text-white/75">
            {[
              [ShieldCheck, "Write actions ask first: “Assign NX-1042 to Amaka?”"],
              [Sparkles, "A built-in shift-handover skill: what's open, what's late, who should take it"],
              [ConciergeBell, "9 tools: list, get, create, assign and update requests, rooms and staff"],
            ].map(([Icon, text], n) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <li key={n} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <I className="size-3.5 text-blue-300" aria-hidden="true" />
                  </span>
                  {text as string}
                </li>
              );
            })}
          </ul>
        </div>

        {/* chat mock */}
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/50 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            <WorkpegMark className="size-6" />
            <span className="text-sm font-semibold">Workpeg AI</span>
            <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/60">/skill shift-handover</span>
          </div>
          <div className="space-y-4 pt-5 text-sm">
            <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5">Give me the shift handover.</p>
            <div className="flex flex-wrap gap-1.5">
              {["shift_summary", "list_open_requests", "list_staff"].map((t) => (
                <span key={t} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-white/60">
                  peg_nexora.{t} ✓
                </span>
              ))}
            </div>
            <div className="max-w-[92%] space-y-3 rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-3 leading-relaxed text-white/85">
              <p>
                <b className="text-white">7 open · 2 overdue · 1 unassigned.</b>
              </p>
              <p className="text-white/70">
                <span className="font-semibold text-red-300">Overdue</span>
                <br />
                NX-1043 · 311 · AC not cooling · High · 24 min late · Tunde
                <br />
                NX-1047 · 115 · Shower drain · Normal · 12 min late · unassigned
              </p>
              <p className="text-white/70">
                <span className="font-semibold text-white">Proposed</span>
                <br />
                1. NX-1047 → Ifeanyi (Maintenance, fewest open tasks)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-ink">Apply 1</span>
              <span className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/70">Change</span>
            </div>
          </div>
          <p className="mt-5 text-center text-[11px] text-white/35">Example of the handover format. Live answers come from your hotel&apos;s own data.</p>
        </div>
      </div>
    </section>
  );
}

function Beyond() {
  const places = [
    { icon: BedDouble, name: "Hotels", what: "Rooms, housekeeping, maintenance, room service", live: true },
    { icon: UtensilsCrossed, name: "Restaurants", what: "Table QR codes: call a waiter, order, ask for the bill", live: false },
    { icon: Wine, name: "Lounges & bars", what: "VIP sections, bottle service, cleaning runs", live: false },
    { icon: Wrench, name: "Short-lets & serviced apartments", what: "Guest issues straight to the caretaker's phone", live: false },
  ];
  return (
    <section id="beyond" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-28">
      <SectionHead eyebrow="Beyond hotels" title="Rooms today. Every table, lounge and apartment next." sub="Anywhere a guest needs something and a team has to deliver it, it's the same loop: ask, route, assign, done." />
      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {places.map(({ icon: Icon, name, what, live }) => (
          <article key={name} className="group flex items-start gap-5 rounded-3xl border border-line bg-surface p-6 transition hover:border-ink/20">
            <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl transition group-hover:rotate-[-6deg]", live ? "bg-ink text-white" : "bg-canvas text-ink")}>
              <Icon className="size-7" aria-hidden="true" />
            </span>
            <div>
              <h3 className="flex flex-wrap items-center gap-2 font-display text-xl font-extrabold">
                {name}
                <span className={cn("rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold", live ? "bg-done-bg text-done" : "bg-neutral-bg text-neutral")}>{live ? "Live now" : "Next"}</span>
              </h3>
              <p className="mt-1 text-muted">{what}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-5 pb-28">
      <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-ink px-6 py-20 text-center text-white sm:px-16">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_80%_at_50%_120%,rgb(0_100_255/0.55),transparent)]" />
        <NexoraMark inverted className="mx-auto size-14 animate-float" />
        <h2 className="mx-auto mt-8 max-w-3xl font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl">See it work in 60 seconds.</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-white/60">Open a guest phone, a housekeeper&apos;s phone and the control room side by side. Send a request and watch it move.</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/demo" className="group inline-flex h-13 items-center gap-2 rounded-2xl bg-white px-7 text-base font-semibold text-ink transition hover:bg-white/90">
            Open the live demo <ArrowUpRight className="size-5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
          </Link>
          <Link href="/login" className="inline-flex h-13 items-center gap-2 rounded-2xl border border-white/20 px-7 text-base font-semibold transition hover:bg-white/10">
            Staff sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted sm:flex-row">
        <NexoraLogo />
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            Built on <WorkpegMark onDark={false} className="size-4" /> Workpeg
          </span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span>Workpeg Hospitality Hackathon, Lagos 2026</span>
        </p>
      </div>
    </footer>
  );
}
