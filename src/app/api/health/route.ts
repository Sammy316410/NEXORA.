import { db } from "@/lib/db";
import { workpegConfig } from "@/lib/workpeg";
import { claudeAvailable } from "@/lib/ai/claude";

export async function GET() {
  let database = "ok";
  try {
    const { error } = await db().from("hotels").select("id").limit(1);
    if (error) database = `error: ${error.message}`;
  } catch (err) {
    database = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
  const wp = workpegConfig();
  return Response.json({
    ok: database === "ok",
    database,
    ai: claudeAvailable() ? "claude" : "rules",
    workpeg: { signIn: wp.signInEnabled, tables: wp.tablesEnabled, bridge: wp.bridgeEnabled },
  });
}
