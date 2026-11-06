import "server-only";
import { db } from "./db";
import { supabaseServer } from "./supabase/server";
import type { Staff } from "./types";

/**
 * Start a Supabase Auth session for a staff member we have already identified
 * some other way (Sign in with Workpeg, or the demo launcher). Uses a one-time
 * magic-link token that never leaves the server.
 */
export async function startStaffSessionFor(staff: Staff): Promise<void> {
  const admin = db().auth.admin;

  let userId = staff.user_id;
  if (!userId) {
    const created = await admin.createUser({
      email: staff.email,
      email_confirm: true,
      user_metadata: { full_name: staff.full_name },
    });
    if (created.error || !created.data.user) throw new Error(`Could not create a login for ${staff.email}: ${created.error?.message}`);
    userId = created.data.user.id;
    await db().from("staff").update({ user_id: userId }).eq("id", staff.id);
  }

  const link = await admin.generateLink({ type: "magiclink", email: staff.email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) throw new Error(`Could not start a session: ${link.error?.message ?? "no token"}`);

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) throw new Error(`Could not start a session: ${error.message}`);

  await db().from("staff").update({ last_seen_at: new Date().toISOString() }).eq("id", staff.id);
}
