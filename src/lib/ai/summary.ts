import "server-only";
import { claudeAvailable, summarizeWithClaude } from "./claude";
import type { Insights, Overview } from "../stats";
import type { Hotel } from "../types";

export interface ShiftSummary {
  engine: "claude" | "rules";
  lines: string[];
  basedOn: number;
  generatedAt: string;
}

const cache = new Map<string, { at: number; value: ShiftSummary }>();
const TTL_MS = 5 * 60_000;

function facts(overview: Overview, insights: Insights) {
  return {
    open: overview.open,
    overdue: overview.needsAttention
      .filter((a) => a.reason === "overdue")
      .map((a) => ({ code: a.request.code, room: a.request.room?.number, request: a.request.title, status: a.label })),
    waitingForOwner: overview.waiting,
    completedToday: overview.completedToday,
    avgResponseTodayMin: overview.avgResponseToday,
    responseTargetMin: overview.responseTarget,
    openByDepartment: overview.workload.map((w) => ({ department: w.name, open: w.pending + w.assigned + w.inProgress })),
    last7Days: {
      requests: insights.total,
      withinTargetShare: insights.withinTarget === null ? null : Math.round(insights.withinTarget * 100) / 100,
      thumbsUp: insights.feedback.up,
      notResolved: insights.feedback.down,
      repeatFaults: insights.repeatRooms,
      departments: insights.departments.map((d) => ({
        department: d.name,
        requests: d.count,
        avgResponseMin: d.avgResponse,
        avgResolutionMin: d.avgResolution,
      })),
    },
  };
}

function templateLines(f: ReturnType<typeof facts>): string[] {
  const lines: string[] = [];
  const busiest = [...f.openByDepartment].sort((a, b) => b.open - a.open)[0];
  if (busiest && busiest.open > 0) {
    lines.push(`${busiest.department} has ${busiest.open} open request${busiest.open === 1 ? "" : "s"}, the most of any team right now.`);
  } else {
    lines.push("No open requests right now.");
  }
  if (f.overdue.length) {
    const first = f.overdue[0];
    lines.push(
      `${f.overdue.length} request${f.overdue.length === 1 ? " is" : "s are"} overdue, including ${first.code} (Room ${first.room}, ${first.request.toLowerCase()}).`,
    );
  } else if (f.waitingForOwner) {
    lines.push(`Nothing is overdue, but ${f.waitingForOwner} request${f.waitingForOwner === 1 ? " has" : "s have"} waited over 5 minutes for an owner.`);
  } else {
    lines.push("Nothing is overdue and every open request has an owner.");
  }
  const repeat = f.last7Days.repeatFaults[0];
  if (repeat) {
    lines.push(`Room ${repeat.room} has had ${repeat.count} ${repeat.service.toLowerCase()} requests in 7 days: a possible recurring fault.`);
  } else if (f.avgResponseTodayMin !== null) {
    lines.push(`Average response today is ${f.avgResponseTodayMin} min against a ${f.responseTargetMin}-minute target.`);
  }
  return lines.slice(0, 3);
}

export async function shiftSummary(hotel: Hotel, overview: Overview, insights: Insights): Promise<ShiftSummary> {
  const f = facts(overview, insights);
  const basedOn = insights.total;
  if (claudeAvailable()) {
    const hit = cache.get(hotel.id);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
    try {
      const lines = await summarizeWithClaude(f, hotel.name);
      const value: ShiftSummary = { engine: "claude", lines, basedOn, generatedAt: new Date().toISOString() };
      cache.set(hotel.id, { at: Date.now(), value });
      return value;
    } catch (err) {
      console.warn("[ai] summary fell back to rules", err instanceof Error ? err.message : err);
    }
  }
  return { engine: "rules", lines: templateLines(f), basedOn, generatedAt: new Date().toISOString() };
}
