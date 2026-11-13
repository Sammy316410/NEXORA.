import { db } from "@/lib/db";
import { getHotel } from "@/lib/hotel";
import { mobile, MobileAuthError, publicAuth, staffForUser } from "@/lib/mobile-auth";
import type { Staff } from "@/lib/types";

// POST { email, password }  -> session tokens and the staff profile.
// POST { refreshToken }     -> fresh tokens (access tokens last about an hour).
// POST { demo: "amaka" }    -> demo mode only (NEXORA_DEMO_MODE=true): one tap opens
//                              the app as a seeded staff member, like /auth/demo on the web.
export async function POST(req: Request) {
  return mobile(async () => {
    const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string; refreshToken?: string; demo?: string };
    const auth = publicAuth();

    let result;
    if (body.refreshToken) {
      result = await auth.refreshSession({ refresh_token: body.refreshToken });
    } else if (body.demo) {
      if (process.env.NEXORA_DEMO_MODE !== "true") throw new MobileAuthError("Demo sign-in is switched off.", 403);
      const who = body.demo.toLowerCase().replace(/[^a-z]/g, "");
      const { data } = await db().from("staff").select("*").eq("email", `${who}@ambercoast.demo`).maybeSingle();
      const staff = data as Staff | null;
      if (!staff) throw new MobileAuthError("That demo profile doesn't exist. Run the seed first.", 404);
      if (!staff.user_id) throw new MobileAuthError("That demo profile has no login yet. Run the seed first.", 404);
      // A one-time magic-link token, made and spent on the server, never sent anywhere.
      const link = await db().auth.admin.generateLink({ type: "magiclink", email: staff.email });
      const tokenHash = link.data?.properties?.hashed_token;
      if (link.error || !tokenHash) throw new MobileAuthError("Couldn't start the demo session.", 500);
      result = await auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    } else {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!email || !password) throw new MobileAuthError("Enter your email and password.", 400);
      result = await auth.signInWithPassword({ email, password });
    }

    const session = result.data.session;
    if (result.error || !session || !result.data.user) {
      throw new MobileAuthError(body.refreshToken ? "Your session has expired. Sign in again." : "That email and password don't match.");
    }
    const staff = await staffForUser(result.data.user.id);
    if (!staff) throw new MobileAuthError("Your account isn't linked to a hotel yet. Ask your manager.", 403);
    await db().from("staff").update({ last_seen_at: new Date().toISOString() }).eq("id", staff.id);
    const hotel = await getHotel();

    return {
      token: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at,
      staff,
      hotel: { name: hotel.name, shortName: hotel.short_name, accent: hotel.accent_color, timezone: hotel.timezone, currency: hotel.currency },
    };
  });
}
