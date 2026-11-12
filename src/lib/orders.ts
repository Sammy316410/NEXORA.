import { db } from "./db";
import type { Payment, RequestItem } from "./types";

export async function listRequestItems(requestId: string): Promise<RequestItem[]> {
  const { data } = await db().from("request_items").select("*").eq("request_id", requestId).order("id");
  return (data as RequestItem[]) ?? [];
}

export async function paymentsForRequest(requestId: string): Promise<Payment[]> {
  const { data } = await db().from("payments").select("*").eq("request_id", requestId).order("created_at", { ascending: false });
  return (data as Payment[]) ?? [];
}
