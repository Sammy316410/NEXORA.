import { getGuest } from "@/lib/guest-session";
import { getStaff } from "@/lib/auth";
import { getHotel, listServices } from "@/lib/hotel";
import { classifyRequest } from "@/lib/ai";
import { DEPARTMENT_LABEL } from "@/lib/labels";

// Live "Looks like: Maintenance" suggestions for G7 and the front desk's log form.
// Signed-in guests and staff only, with a small per-session rate limit.

const hits = new Map<string, number[]>();
function limited(key: string, max = 12, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

export async function POST(request: Request) {
  const guest = await getGuest();
  const staff = guest ? null : await getStaff();
  if (!guest && !staff) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (limited(guest ? `g:${guest.reservation.id}` : `s:${staff!.id}`)) {
    return Response.json({ error: "Slow down a little and try again." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 3) return Response.json({ error: "Tell us a little more." }, { status: 400 });

  const hotel = guest?.hotel ?? (await getHotel());
  const services = await listServices(hotel.id);
  const result = await classifyRequest(text.slice(0, 1000), services, hotel.name);
  const byId = new Map(services.map((s) => [s.id, s]));

  return Response.json({
    engine: result.engine,
    items: result.items.map((item) => {
      const s = byId.get(item.serviceId)!;
      return {
        ...item,
        serviceName: s.name,
        icon: s.icon,
        department: DEPARTMENT_LABEL[s.department_id] ?? s.department_id,
        hasQuantity: s.has_quantity,
        maxQuantity: s.max_quantity,
        guestVisible: s.guest_visible,
      };
    }),
  });
}
