import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff, homeFor } from "@/lib/auth";
import { workpegConfig } from "@/lib/workpeg";
import { signIn } from "@/app/actions/staff";
import { LoginForm } from "@/components/login-form";
import { NexoraLogo, WorkpegMark } from "@/components/brand";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  workpeg_not_configured: "Sign in with Workpeg isn't switched on yet. Add the Workpeg client ID and secret (hackathon day), or use email for now.",
  workpeg_unreachable: "We couldn't reach Workpeg. Try again, or use email.",
  workpeg_failed: "Workpeg sign-in didn't complete. Please try again.",
  workpeg_state: "That sign-in link expired. Please start again.",
  workpeg_not_linked: "Your Workpeg account isn't linked to Amber Coast Hotel yet. Ask your manager.",
  demo_user: "That demo profile doesn't exist. Run the seed first.",
};

const DEMO_PROFILES = [
  { as: "grace", name: "Grace", role: "Front desk lead · dashboard" },
  { as: "funmi", name: "Funmi", role: "General manager · dashboard" },
  { as: "amaka", name: "Amaka", role: "Housekeeping · staff app" },
  { as: "tunde", name: "Tunde", role: "Maintenance · staff app" },
];

// S1 + M1: one sign-in page for staff and managers.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const staff = await getStaff();
  if (staff) redirect(homeFor(staff));
  const wp = workpegConfig();
  const demo = process.env.NEXORA_DEMO_MODE === "true";

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <NexoraLogo inverted />
        <div>
          <p className="font-display text-4xl leading-tight font-extrabold tracking-tight">
            Every request
            <br />
            accounted for.
          </p>
          <p className="mt-4 max-w-md text-white/70">
            Guests ask from their phone. The front desk assigns in one click. Staff start and finish on theirs. Everyone sees the same request, live.
          </p>
        </div>
        <div className="grid max-w-md grid-cols-3 gap-3 text-sm">
          {["Received", "On it", "Done"].map((s, i) => (
            <div key={s} className="rounded-2xl border border-white/15 bg-white/5 p-3">
              <p className="text-white/50">Step {i + 1}</p>
              <p className="font-semibold">{s}</p>
            </div>
          ))}
        </div>
        <div className="absolute -right-24 -bottom-24 size-96 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
      </aside>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <NexoraLogo />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Sign in to Amber Coast Hotel</h1>
          <p className="mt-1 text-sm text-muted">Use your hotel&apos;s Workpeg account.</p>

          {error && ERRORS[error] ? (
            <p role="alert" className="mt-5 rounded-xl bg-alert-bg px-3.5 py-2.5 text-sm text-alert">
              {ERRORS[error]}
            </p>
          ) : null}

          <a
            href={`/auth/workpeg/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            aria-disabled={!wp.signInEnabled}
            className={cn(
              "mt-6 flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-black text-[15px] font-medium text-white transition-colors hover:bg-ink-soft",
              !wp.signInEnabled && "opacity-60",
            )}
          >
            <WorkpegMark onDark className="size-5" />
            Sign in with Workpeg
          </a>
          {!wp.signInEnabled ? (
            <p className="mt-2 text-center text-xs text-muted">Switches on once the Workpeg client ID is added.</p>
          ) : null}

          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>

          <LoginForm action={signIn} next={next} />

          {demo ? (
            <section className="mt-8 rounded-2xl border border-dashed border-line-strong p-4">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Demo: open as</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DEMO_PROFILES.map((p) => (
                  <Link key={p.as} href={`/auth/demo?as=${p.as}`} prefetch={false} className={buttonClass("secondary", "md", "h-auto flex-col items-start py-2 text-left")}>
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-[11px] font-normal text-muted">{p.role}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
