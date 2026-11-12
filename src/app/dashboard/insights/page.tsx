import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { getHotel, listStaff } from "@/lib/hotel";
import { getInsights, getOverview } from "@/lib/stats";
import { shiftSummary } from "@/lib/ai/summary";
import { fmtDuration, fmtTime } from "@/lib/format";
import { Card, CardHeader, KpiTile, PageTitle } from "@/components/ui";
import { WeekColumns } from "@/components/dashboard/charts";

export const metadata: Metadata = { title: "Insights" };

const CATEGORY_LABEL: Record<string, string> = {
  amenities: "Amenities",
  housekeeping: "Housekeeping",
  maintenance: "Maintenance",
  food: "Food and drinks",
  front_desk: "Front desk",
};

// M11: verified numbers and the AI summary, kept visibly apart.
export default async function InsightsPage() {
  await requireManager();
  const hotel = await getHotel();
  const staff = await listStaff(hotel.id);
  const [insights, overview] = await Promise.all([getInsights(hotel), getOverview(hotel, staff)]);
  const summary = await shiftSummary(hotel, overview, insights);
  const maxCat = Math.max(1, ...insights.categories.map((c) => c.count));

  return (
    <div className="space-y-5">
      <PageTitle title="Insights" subtitle="Last 7 days. Every number below comes straight from request records." />

      <section className="rounded-2xl border border-dashed border-ink/25 bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold">
            <Sparkles className="size-4" aria-hidden="true" /> {summary.engine === "claude" ? "AI summary" : "Auto-summary"}
          </h2>
          <span className="text-xs text-muted">
            {summary.engine === "claude" ? "AI-generated · check before acting" : "Rule-based, from the numbers below"} · based on {summary.basedOn} requests ·{" "}
            {fmtTime(summary.generatedAt, hotel.timezone)}
          </span>
        </div>
        <ul className="mt-3 space-y-2 text-[15px]">
          {summary.lines.map((l) => (
            <li key={l} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              {l}
            </li>
          ))}
        </ul>
      </section>

      <h2 className="pt-2 text-sm font-semibold text-muted">Verified metrics</h2>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Requests, 7 days" value={insights.total} />
        <KpiTile label="Done within target" value={insights.withinTarget === null ? "—" : `${Math.round(insights.withinTarget * 100)}%`} sub="Resolution vs each service's target" />
        <KpiTile label="Guest thumbs up" value={insights.feedback.rate === null ? "—" : `${Math.round(insights.feedback.rate * 100)}%`} sub={`${insights.feedback.up} up · ${insights.feedback.down} not resolved`} />
        <KpiTile label="Repeat faults" value={insights.repeatRooms.length} sub="Rooms with 2+ of the same fix" tone={insights.repeatRooms.length ? "alert" : undefined} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Requests per day"
            subtitle={
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#BFD4FF]" />Received</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" />Completed</span>
              </span>
            }
          />
          <div className="px-5 pb-5">
            <WeekColumns days={insights.days} />
          </div>
        </Card>
        <Card>
          <CardHeader title="By category" />
          <ul className="space-y-3 px-5 pb-5">
            {insights.categories.map((c) => (
              <li key={c.category}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{CATEGORY_LABEL[c.category] ?? c.category}</span>
                  <span className="font-semibold tabular-nums">{c.count}</span>
                </div>
                <div className="h-2 rounded-full bg-line">
                  <div className="h-2 rounded-full bg-ink" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Card className="overflow-x-auto">
        <CardHeader title="Departments" subtitle="Response = sent → started. Resolution = sent → done." />
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-y border-line text-xs text-muted">
            <tr>
              {["Department", "Requests", "Avg response", "Avg resolution", "Within target"].map((h) => (
                <th key={h} className="px-5 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {insights.departments.map((d) => (
              <tr key={d.departmentId} className="border-b border-line last:border-0">
                <td className="px-5 py-2.5 font-medium">{d.name}</td>
                <td className="px-5 py-2.5 tabular-nums">{d.count}</td>
                <td className="px-5 py-2.5 tabular-nums">{d.avgResponse === null ? "—" : fmtDuration(d.avgResponse)}</td>
                <td className="px-5 py-2.5 tabular-nums">{d.avgResolution === null ? "—" : fmtDuration(d.avgResolution)}</td>
                <td className="px-5 py-2.5 tabular-nums">{d.withinTarget === null ? "—" : `${Math.round(d.withinTarget * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {insights.repeatRooms.length ? (
        <Card>
          <CardHeader title="Rooms with repeat faults" subtitle="Same maintenance service twice or more in 7 days" />
          <ul className="divide-y divide-line border-t border-line">
            {insights.repeatRooms.map((r) => (
              <li key={`${r.room}-${r.service}`} className="flex items-center gap-4 px-5 py-3 text-sm">
                <span className="w-14 font-display text-lg font-extrabold tabular-nums">{r.room}</span>
                <span className="flex-1">{r.service}</span>
                <span className="font-semibold tabular-nums">{r.count}×</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <p className="text-xs text-muted">Average response today: {overview.avgResponseToday === null ? "—" : fmtDuration(overview.avgResponseToday)}.</p>
    </div>
  );
}
