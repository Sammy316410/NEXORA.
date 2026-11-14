import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { homeFor } from "@/lib/auth";
import { startStaffSessionFor } from "@/lib/staff-session";
import type { Staff } from "@/lib/types";
import { STAFF_EMAIL_DOMAIN } from "@/lib/seed/catalog";

// Demo launcher only (NEXORA_DEMO_MODE=true): one tap opens the staff app as a
// seeded staff member, so the judging demo doesn't stall on typing passwords.
export async function GET(request: NextRequest) {
  if (process.env.NEXORA_DEMO_MODE !== "true") redirect("/login");
  const who = (request.nextUrl.searchParams.get("as") ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const { data } = await db().from("staff").select("*").eq("email", `${who}${STAFF_EMAIL_DOMAIN}`).maybeSingle();
  if (!data) redirect("/login?error=demo_user");
  const staff = data as Staff;
  await startStaffSessionFor(staff);
  redirect(homeFor(staff));
}
