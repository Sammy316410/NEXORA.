// Seed (or re-seed) the demo hotel.
//   npm run db:seed
// Reads .env.local (via `node --env-file`). Safe to run repeatedly.
import { createClient } from "@supabase/supabase-js";
import { seedDemo } from "../src/lib/seed";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first (see .env.example).");
    process.exit(1);
  }
  const password = process.env.DEMO_STAFF_PASSWORD || "nexora-demo-2026";
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const result = await seedDemo(db, { password, log: (m) => console.log(`  ${m}`) });
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log("\nSeeded Amber Coast Hotel.");
  console.log(`  Staff sign-in:  grace@ambercoast.demo (front desk), amaka@ambercoast.demo (housekeeping), password ${password}`);
  if (result.davidToken) console.log(`  Guest link (David, Room 204, last name Okafor): ${appUrl}/g/${result.davidToken}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
