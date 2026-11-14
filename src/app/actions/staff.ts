"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { attempt, type ActionResult } from "@/lib/action-result";
import { actorFor, homeFor, requireStaff } from "@/lib/auth";
import { setOnDuty } from "@/lib/hotel";
import { claimRequest, completeRequest, handBackRequest, startRequest } from "@/lib/requests";
import { supabaseServer } from "@/lib/supabase/server";

/** S1/M1: email + password (Supabase Auth). Sign in with Workpeg lives in /auth/workpeg. */
export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!email || !password) return { ok: false, error: "Enter your email and password." };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, error: "That email and password don't match." };

  const { data: staff } = await db().from("staff").select("id, role").eq("user_id", data.user.id).maybeSingle();
  if (!staff) {
    await supabase.auth.signOut();
    return { ok: false, error: "Your account isn't linked to this hotel yet. Ask your manager." };
  }
  await db().from("staff").update({ last_seen_at: new Date().toISOString() }).eq("id", staff.id);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : homeFor(staff));
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

function refresh() {
  revalidatePath("/staff", "layout");
  revalidatePath("/dashboard", "layout");
}

export async function startTask(requestId: string): Promise<ActionResult> {
  return attempt(async () => {
    const staff = await requireStaff();
    await startRequest(requestId, actorFor(staff));
    refresh();
    return { ok: true, message: "Started. The guest can see you're on the way." };
  });
}

export async function completeTask(requestId: string, formData?: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const staff = await requireStaff();
    const note = formData ? String(formData.get("note") ?? "") : "";
    const followUp = formData?.get("followUp") === "on";
    await completeRequest(requestId, actorFor(staff), { note, followUp });
    refresh();
    return { ok: true, message: "Marked complete." };
  });
}

export async function handBackTask(requestId: string, formData: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const staff = await requireStaff();
    const reason = String(formData.get("reason") ?? "").trim();
    await handBackRequest(requestId, actorFor(staff), reason || "No reason given");
    refresh();
    return { ok: true, message: "Sent back to the front desk with your reason." };
  });
}

export async function claimTask(requestId: string): Promise<ActionResult> {
  return attempt(async () => {
    const staff = await requireStaff();
    await claimRequest(requestId, staff);
    refresh();
    return { ok: true, message: "It's yours. Find it under To do." };
  });
}

export async function setMyDuty(onDuty: boolean): Promise<ActionResult> {
  return attempt(async () => {
    const staff = await requireStaff();
    await setOnDuty(staff.id, onDuty);
    refresh();
    return { ok: true, message: onDuty ? "You're on duty." : "You're off duty. Alerts are muted." };
  });
}
