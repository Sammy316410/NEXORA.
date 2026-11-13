import "server-only";
import { createClient } from "@supabase/supabase-js";
import { db } from "./db";
import { EngineError } from "./requests";
import type { Staff } from "./types";

// The NEXORA mobile app (mobile/) signs staff in with the same Supabase Auth
// accounts as the web app, then sends the access token as a Bearer header.
// Every /api/mobile route resolves that token to a staff row here.

export class MobileAuthError extends Error {
  constructor(
    message: string,
    public status = 401,
  ) {
    super(message);
  }
}

/** A Supabase client that acts as the anonymous public app: used only to sign in and refresh. */
export function publicAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new MobileAuthError("Sign-in is not configured on the server.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth;
}

export async function staffForUser(userId: string): Promise<Staff | null> {
  const { data } = await db().from("staff").select("*").eq("user_id", userId).maybeSingle();
  return (data as Staff | null) ?? null;
}

export async function requireMobileStaff(req: Request): Promise<Staff> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new MobileAuthError("Sign in to continue.");
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) throw new MobileAuthError("Your session has expired. Sign in again.");
  const staff = await staffForUser(data.user.id);
  if (!staff) throw new MobileAuthError("Your account isn't linked to a hotel yet. Ask your manager.", 403);
  return staff;
}

/** Runs a mobile handler and turns auth and engine errors into JSON the app can show. */
export async function mobile(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (err) {
    if (err instanceof MobileAuthError) return Response.json({ error: err.message }, { status: err.status });
    if (err instanceof EngineError) return Response.json({ error: err.message, code: err.code }, { status: 409 });
    console.error("[mobile] failed", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
