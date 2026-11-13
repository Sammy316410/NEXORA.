import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client. Bypasses row level security, so it must only ever run on
// the server, after the caller's guest or staff session has been checked.
let admin: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example)",
      );
    }
    admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

/**
 * A value for `.ilike()` meant to match exactly, ignoring case. Escapes `%`, `_` and `\`,
 * which ilike would otherwise treat as wildcards (`amaka_obi@` would also match `amakaxobi@`).
 * PostgREST also reads `*` as a wildcard and it can't be escaped, so callers must still
 * check the row they get back with `sameText`.
 */
export function exactIlike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/** True when two strings are equal ignoring case and surrounding spaces. */
export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

/** Throws a readable error when a Supabase call fails. */
export function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: not found`);
  return result.data;
}
