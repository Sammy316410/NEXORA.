import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { supabaseServer } from "./supabase/server";
import type { Actor, Staff } from "./types";

/** The signed-in staff member (Supabase Auth session -> staff row), or null. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await db().from("staff").select("*").eq("user_id", user.id).maybeSingle();
  return (data as Staff | null) ?? null;
});

export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return staff;
}

/** Front desk, managers and admins. Floor staff are sent to their task list. */
export async function requireManager(): Promise<Staff> {
  const staff = await requireStaff();
  if (!isManager(staff)) redirect("/staff");
  return staff;
}

export function isManager(staff: Pick<Staff, "role">): boolean {
  return staff.role !== "staff";
}

export function homeFor(staff: Pick<Staff, "role">): string {
  return isManager(staff) ? "/dashboard" : "/staff";
}

export function actorFor(staff: Staff): Actor {
  return { type: isManager(staff) ? "manager" : "staff", id: staff.id, name: staff.full_name };
}
