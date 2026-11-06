"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser client, used ONLY to listen for Realtime pings. It never reads tables:
// row level security blocks that, by design.
let client: SupabaseClient | null | undefined;

export function realtimeClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}
