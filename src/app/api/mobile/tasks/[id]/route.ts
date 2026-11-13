import { isManager, actorFor } from "@/lib/auth";
import { claimRequest, completeRequest, getEvents, getRequest, handBackRequest, listRequests, startRequest } from "@/lib/requests";
import { isoMinutesAgo } from "@/lib/format";
import { mobile, MobileAuthError, requireMobileStaff } from "@/lib/mobile-auth";
import { mobileTask, refreshWeb } from "@/lib/mobile-view";
import type { RequestView, Staff } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

async function loadTask(id: string, staff: Staff, opts: { allowPool?: boolean } = {}): Promise<RequestView> {
  const r = await getRequest(id);
  if (!r || r.hotel_id !== staff.hotel_id) throw new MobileAuthError("That task doesn't exist.", 404);
  const inMyPool = opts.allowPool && r.status === "pending" && !r.assignee_id && r.department_id === staff.department_id;
  if (r.assignee_id !== staff.id && !isManager(staff) && !inMyPool) throw new MobileAuthError("That task isn't assigned to you.", 404);
  return r;
}

// GET: one task with its history and how busy the room has been. Same view as /staff/tasks/[id].
export async function GET(req: Request, { params }: Params) {
  return mobile(async () => {
    const { id } = await params;
    const staff = await requireMobileStaff(req);
    const r = await loadTask(id, staff, { allowPool: true });
    const [events, roomHistory] = await Promise.all([
      getEvents(r.id),
      listRequests({ hotelId: r.hotel_id, roomId: r.room_id, since: isoMinutesAgo(24 * 60), limit: 10 }),
    ]);
    return {
      task: mobileTask(r),
      events: events.map((e) => ({ id: e.id, at: e.created_at, message: e.message })),
      otherRequestsFromRoom: roomHistory.filter((x) => x.id !== r.id).length,
    };
  });
}

// POST { action: "claim" | "start" | "complete" | "handback", note?, followUp?, reason? }
export async function POST(req: Request, { params }: Params) {
  return mobile(async () => {
    const { id } = await params;
    const staff = await requireMobileStaff(req);
    const body = (await req.json().catch(() => ({}))) as { action?: string; note?: string; followUp?: boolean; reason?: string };
    const actor = actorFor(staff);

    let message: string;
    switch (body.action) {
      case "claim":
        await loadTask(id, staff, { allowPool: true });
        await claimRequest(id, staff);
        message = "It's yours. Find it under To do.";
        break;
      case "start":
        await loadTask(id, staff);
        await startRequest(id, actor);
        message = "Started. The guest can see you're on the way.";
        break;
      case "complete":
        await loadTask(id, staff);
        await completeRequest(id, actor, { note: String(body.note ?? ""), followUp: body.followUp === true });
        message = "Marked complete.";
        break;
      case "handback":
        await loadTask(id, staff);
        await handBackRequest(id, actor, String(body.reason ?? "").trim() || "No reason given");
        message = "Sent back to the front desk with your reason.";
        break;
      default:
        throw new MobileAuthError("Unknown action.", 400);
    }
    refreshWeb();
    const updated = await getRequest(id);
    return { ok: true, message, task: updated ? mobileTask(updated) : null };
  });
}
