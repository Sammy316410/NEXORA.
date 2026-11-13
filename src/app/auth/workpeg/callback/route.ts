import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { db, exactIlike, sameText } from "@/lib/db";
import { homeFor } from "@/lib/auth";
import { logIntegration, workpegConfig } from "@/lib/workpeg";
import { oidc, workpegOidc } from "@/lib/workpeg-oidc";
import { startStaffSessionFor } from "@/lib/staff-session";
import type { Staff } from "@/lib/types";

const OIDC_COOKIE = "nx_wp_oidc";

// Finishes "Sign in with Workpeg": verify the ID token, find the staff member by
// Workpeg subject (or email on first sign-in), then start their NEXORA session.
export async function GET(request: NextRequest) {
  const cfg = workpegConfig();
  const jar = await cookies();
  const raw = jar.get(OIDC_COOKIE)?.value;
  jar.delete({ name: OIDC_COOKIE, path: "/auth/workpeg" });
  if (!raw) redirect("/login?error=workpeg_state");

  let saved: { verifier: string; state: string; nonce: string; next?: string };
  try {
    saved = JSON.parse(raw);
  } catch {
    redirect("/login?error=workpeg_state");
  }

  let claims: oidc.IDToken | undefined;
  try {
    const config = await workpegOidc();
    // Build the callback URL from APP_URL so it matches the registered redirect URI exactly.
    const current = new URL(`${cfg.appUrl}/auth/workpeg/callback${request.nextUrl.search}`);
    const tokens = await oidc.authorizationCodeGrant(config, current, {
      pkceCodeVerifier: saved.verifier,
      expectedState: saved.state,
      expectedNonce: saved.nonce,
      idTokenExpected: true,
    });
    claims = tokens.claims();
  } catch (err) {
    console.error("[workpeg] sign-in failed", err);
    await logIntegration(null, "Sign in with Workpeg failed", "error", err instanceof Error ? err.message : String(err));
    redirect("/login?error=workpeg_failed");
  }
  if (!claims?.sub) redirect("/login?error=workpeg_failed");

  const subject = String(claims.sub);
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : null;
  const business = typeof claims.workpeg_business_name === "string" ? claims.workpeg_business_name : null;

  let { data: staff } = await db().from("staff").select("*").eq("workpeg_subject", subject).maybeSingle();
  if (!staff && email) {
    // Exact match ignoring case. The re-check also covers `*`, which PostgREST reads as a wildcard.
    const byEmail = await db().from("staff").select("*").ilike("email", exactIlike(email)).maybeSingle();
    staff = byEmail.data && sameText(byEmail.data.email, email) ? byEmail.data : null;
    if (staff) await db().from("staff").update({ workpeg_subject: subject }).eq("id", staff.id);
  }
  if (!staff) {
    await logIntegration(null, `Workpeg sign-in by ${email ?? subject} has no NEXORA staff account`, "blocked", business ?? undefined);
    redirect("/login?error=workpeg_not_linked");
  }

  const member = staff as Staff;
  await startStaffSessionFor(member);
  await logIntegration(member.hotel_id, `${member.full_name} signed in with Workpeg`, "ok", business ? `Business: ${business}` : undefined);

  const next = saved.next && saved.next.startsWith("/") && !saved.next.startsWith("//") ? saved.next : homeFor(member);
  redirect(next);
}
