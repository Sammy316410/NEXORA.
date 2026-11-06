import type { Metadata } from "next";
import { Bot, CircleCheck, CircleDashed, CreditCard, KeyRound, Table2 } from "lucide-react";
import { paymentsConfig } from "@/lib/payments/config";
import { requireManager } from "@/lib/auth";
import { getHotel } from "@/lib/hotel";
import { db } from "@/lib/db";
import { workpegConfig } from "@/lib/workpeg";
import { claudeAvailable } from "@/lib/ai/claude";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, CardHeader, PageTitle } from "@/components/ui";
import { Chip } from "@/components/status";
import { WorkpegMark } from "@/components/brand";

export const metadata: Metadata = { title: "Integrations" };

const ACTIONS = [
  ["list_open_requests", "read"],
  ["get_request", "read"],
  ["list_rooms", "read"],
  ["list_staff", "read"],
  ["shift_summary", "read"],
  ["assign_request", "write"],
  ["update_request_status", "write"],
  ["create_request", "write"],
  ["set_room_status", "write"],
] as const;

// M5: the Workpeg connection, what it does, and an honest activity log.
export default async function IntegrationsPage() {
  await requireManager();
  const hotel = await getHotel();
  const cfg = workpegConfig();
  const pay = paymentsConfig();
  const [{ data: events }, { count: mirrored }, { data: table }] = await Promise.all([
    db().from("integration_events").select("*").eq("provider", "workpeg").order("created_at", { ascending: false }).limit(40),
    db().from("workpeg_links").select("entity_id", { count: "exact", head: true }).eq("entity", "request"),
    db().from("app_settings").select("value").eq("key", "workpeg_requests_table").maybeSingle(),
  ]);
  const tableId = cfg.requestsTable ?? (table?.value as { uuid?: string } | undefined)?.uuid ?? null;
  const connected = cfg.signInEnabled || cfg.tablesEnabled || cfg.bridgeEnabled;

  const feature = (on: boolean, Icon: typeof KeyRound, title: string, detail: string, setup: string) => (
    <li className="flex items-start gap-3 rounded-xl border border-line p-4">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", on ? "bg-done-bg text-done" : "bg-neutral-bg text-neutral")}>
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold">
          {title}
          {on ? <Chip tone="done" icon={CircleCheck}>On</Chip> : <Chip tone="neutral" icon={CircleDashed}>Not set up</Chip>}
        </p>
        <p className="mt-0.5 text-sm text-muted">{on ? detail : setup}</p>
      </div>
    </li>
  );

  return (
    <div className="space-y-5">
      <PageTitle title="Integrations" subtitle="How NEXORA works with the hotel's Workpeg workspace." />

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <WorkpegMark onDark={false} className="size-12" />
          <div className="flex-1">
            <p className="font-display text-lg font-extrabold">Workpeg</p>
            <p className="text-sm text-muted">
              Namespace <span className="font-mono text-ink">nexora</span>
              {cfg.businessId ? (
                <>
                  {" "}
                  · business <span className="font-mono text-ink">{cfg.businessId.slice(0, 8)}…</span>
                </>
              ) : null}
            </p>
          </div>
          <Chip tone={connected ? "done" : "neutral"} size="md">
            {connected ? "Connected" : "Waiting for credentials"}
          </Chip>
        </div>
        <ul className="mt-5 grid gap-3 lg:grid-cols-3">
          {feature(
            cfg.signInEnabled,
            KeyRound,
            "Sign in with Workpeg",
            "Staff and managers sign in with their Workpeg account (OpenID Connect, PKCE).",
            "Add WORKPEG_CLIENT_ID and WORKPEG_CLIENT_SECRET, and register {APP_URL}/auth/workpeg/callback.",
          )}
          {feature(
            cfg.tablesEnabled,
            Table2,
            "Requests saved to Workpeg Tables",
            `Every request is mirrored to the “NEXORA Requests” table${tableId ? ` (${tableId.slice(0, 8)}…)` : ""}. ${mirrored ?? 0} mirrored so far.`,
            "Add WORKPEG_PK and WORKPEG_BUSINESS_ID. The table is created on the first sync.",
          )}
          {feature(
            cfg.bridgeEnabled,
            Bot,
            "Workpeg AI actions",
            "The NEXORA peg exposes 9 actions. Workpeg AI's writes are recorded as “via Workpeg AI, for <person>”.",
            "Set NEXORA_BRIDGE_SECRET here and in the peg function, then submit the peg (see workpeg/README.md).",
          )}
        </ul>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-ink text-white">
            <CreditCard className="size-6" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="font-display text-lg font-extrabold">Payments · {pay.label}</p>
            <p className="text-sm text-muted">
              Currency {pay.currency} · webhook <span className="font-mono text-ink">{pay.webhookUrl}</span>
            </p>
          </div>
          <Chip tone={pay.problem ? "alert" : pay.mode === "test" ? "progress" : "done"} size="md">
            {pay.problem ? "Off" : pay.mode === "test" ? "Test mode · no real money" : "Live"}
          </Chip>
        </div>
        {pay.problem ? <p className="mt-3 rounded-xl bg-alert-bg px-3 py-2 text-sm text-alert">{pay.problem}</p> : null}
        {pay.note ? <p className="mt-3 text-sm text-muted">{pay.note}</p> : null}
        <ol className="mt-4 grid gap-3 text-sm lg:grid-cols-3">
          <li className="rounded-xl border border-line p-3">
            <p className="font-semibold">1 · Sandbox (now)</p>
            <p className="text-muted">Built-in gateway, test cards only. No keys needed.</p>
          </li>
          <li className="rounded-xl border border-line p-3">
            <p className="font-semibold">2 · Paystack test mode</p>
            <p className="text-muted">
              <span className="font-mono">PAYMENT_PROVIDER=paystack</span> + an <span className="font-mono">sk_test_</span> key. Set the webhook URL above in Paystack.
            </p>
          </li>
          <li className="rounded-xl border border-line p-3">
            <p className="font-semibold">3 · Live</p>
            <p className="text-muted">
              Swap in the <span className="font-mono">sk_live_</span> key and set <span className="font-mono">PAYMENTS_ALLOW_LIVE=true</span>. No code changes.
            </p>
          </li>
        </ol>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Actions published to Workpeg AI" subtitle="Tool names are peg_nexora.<action>" />
          <ul className="divide-y divide-line border-t border-line text-sm">
            {ACTIONS.map(([name, risk]) => (
              <li key={name} className="flex items-center justify-between px-5 py-2.5">
                <span className="font-mono">{name}</span>
                <Chip tone={risk === "read" ? "neutral" : "progress"}>{risk}</Chip>
              </li>
            ))}
          </ul>
          <p className="px-5 py-3 text-xs text-muted">AI sorting of free-text requests: {claudeAvailable() ? "Claude" : "keyword rules (add ANTHROPIC_API_KEY for Claude)"}.</p>
        </Card>

        <Card>
          <CardHeader title="Activity log" subtitle="Every Workpeg call NEXORA made or received" />
          {events && events.length ? (
            <table className="w-full text-left text-sm">
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-line">
                    <td className="w-36 px-5 py-2.5 text-xs whitespace-nowrap text-muted tabular-nums">{fmtDateTime(e.created_at, hotel.timezone)}</td>
                    <td className="px-2 py-2.5">
                      {e.event}
                      {e.detail ? <span className="block text-xs text-muted">{e.detail}</span> : null}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Chip tone={e.result === "ok" ? "done" : e.result === "blocked" ? "progress" : e.result === "error" ? "alert" : "neutral"}>{e.result}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="border-t border-line px-5 py-10 text-center text-sm text-muted">
              Nothing yet. Entries appear as soon as Workpeg credentials are added and the first request syncs.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}
