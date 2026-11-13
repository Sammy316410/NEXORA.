import { setOnDuty } from "@/lib/hotel";
import { mobile, requireMobileStaff } from "@/lib/mobile-auth";
import { refreshWeb } from "@/lib/mobile-view";

// POST { onDuty: boolean }: the same on/off duty switch as the web staff profile.
export async function POST(req: Request) {
  return mobile(async () => {
    const staff = await requireMobileStaff(req);
    const body = (await req.json().catch(() => ({}))) as { onDuty?: boolean };
    const onDuty = body.onDuty === true;
    await setOnDuty(staff.id, onDuty);
    refreshWeb();
    return { ok: true, onDuty, message: onDuty ? "You're on duty." : "You're off duty. Alerts are muted." };
  });
}
