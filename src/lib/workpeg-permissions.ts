// Workpeg inbound permission (see peg/docs/workpeg/permissions.md).
//
// The NEXORA peg declares a "guest_requests" inbound permission on its
// `requests` table. When a hotel's owner or admin presses Allow, Workpeg POSTs
// the key to /api/workpeg/permissions, signed with WORKPEG_PERMISSION_SECRET.
// We verify it, confirm the key with whoami, store it encrypted, and from then
// on every request a guest sends from the room-QR page is added to the peg's
// Board with that key.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { logIntegration, workpegConfig } from "./workpeg";
import type { RequestView } from "./types";

const MAX_SKEW_SECONDS = 300;
const DELIVERY_MEMORY_MS = 10 * 60_000;

export interface PermissionEvent {
  business: string;
  delivery: string;
  event: "permission.granted" | "permission.revoked";
  grant: string;
  key?: string;
  key_id: string | null;
  kind: string;
  name: string;
  peg: string;
  reason: string;
  sequence: number;
  table: string;
}

export class PermissionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function permissionSecret(): string {
  const secret = process.env.WORKPEG_PERMISSION_SECRET?.trim();
  if (!secret) throw new PermissionError("WORKPEG_PERMISSION_SECRET is not set", 503);
  return secret;
}

/** 32-byte key for sealing inbound keys at rest. */
function sealingKey(): Buffer {
  const own = process.env.WORKPEG_KEY_ENCRYPTION_KEY?.trim();
  const base = own || process.env.NEXORA_SESSION_SECRET?.trim();
  if (!base) throw new PermissionError("WORKPEG_KEY_ENCRYPTION_KEY is not set", 503);
  return createHash("sha256").update(`nexora-workpeg-inbound:${base}`).digest();
}

function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealingKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

function unseal(sealed: string): string {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", sealingKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

/**
 * Steps 2 to 5 of Workpeg's checklist: the four headers, a fresh timestamp,
 * the signature over the raw body, and a body that matches its headers.
 */
export function verifyDelivery(headers: Headers, raw: string): PermissionEvent {
  const sig = headers.get("x-workpeg-signature") ?? "";
  const ts = headers.get("x-workpeg-timestamp") ?? "";
  const event = headers.get("x-workpeg-event") ?? "";
  const delivery = headers.get("x-workpeg-delivery") ?? "";
  if (!sig || !/^\d+$/.test(ts) || !event || !delivery) throw new PermissionError("Missing Workpeg headers", 401);
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW_SECONDS) throw new PermissionError("Stale timestamp", 401);

  const want = "v1=" + createHmac("sha256", permissionSecret()).update(`${ts}.${raw}`, "utf8").digest("hex");
  const a = Buffer.from(want);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new PermissionError("Bad signature", 401);

  let body: PermissionEvent;
  try {
    body = JSON.parse(raw) as PermissionEvent;
  } catch {
    throw new PermissionError("Body is not JSON", 400);
  }
  if (body.event !== event || body.delivery !== delivery) throw new PermissionError("Body does not match headers", 401);
  return body;
}

/** Refuse a delivery id seen in the last 10 minutes; remember this one. */
export async function rememberDelivery(delivery: string): Promise<void> {
  const cutoff = new Date(Date.now() - DELIVERY_MEMORY_MS).toISOString();
  await db().from("workpeg_deliveries").delete().lt("seen_at", cutoff);
  const { error } = await db().from("workpeg_deliveries").insert({ delivery });
  if (error?.code === "23505") throw new PermissionError("Delivery already seen", 409);
  if (error) throw new PermissionError(`Could not record the delivery: ${error.message}`, 500);
}

/** Step 6: whoami must name the same business, table and grant. This also confirms the key. */
async function confirmKey(body: PermissionEvent): Promise<void> {
  const { apiBase } = workpegConfig();
  const res = await fetch(`${apiBase}/v1/inbound/whoami/`, {
    headers: { Authorization: `Bearer ${body.key}` },
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status !== 200) throw new PermissionError(`whoami answered ${res.status}`, 422);
  const bound = (await res.json()) as Record<string, unknown>;
  for (const k of ["business", "table", "grant"] as const) {
    if (bound[k] !== body[k]) throw new PermissionError(`whoami ${k} does not match`, 422);
  }
}

/** Step 7: keep only the highest sequence per business and table. */
export async function storeGrantedKey(body: PermissionEvent): Promise<void> {
  if (!body.key) throw new PermissionError("Granted event without a key", 400);
  const { data: held } = await db()
    .from("workpeg_inbound_keys")
    .select("sequence")
    .eq("business", body.business)
    .eq("table_uuid", body.table)
    .maybeSingle();
  if (held && held.sequence >= body.sequence) throw new PermissionError("Sequence not above the one held", 409);

  await confirmKey(body);
  const { error } = await db().from("workpeg_inbound_keys").upsert({
    business: body.business,
    table_uuid: body.table,
    grant_id: body.grant,
    key_id: body.key_id,
    sequence: body.sequence,
    name: body.name,
    key_cipher: seal(body.key),
    revoked_at: null,
    received_at: new Date().toISOString(),
  });
  if (error) throw new PermissionError(`Could not store the key: ${error.message}`, 500);
  await logIntegration(null, "permission.granted", "ok", `${body.name} (${body.reason}), sequence ${body.sequence}`);
}

/** permission.revoked: drop the key (it already stopped working at Workpeg). */
export async function dropRevokedKey(body: PermissionEvent): Promise<void> {
  await db()
    .from("workpeg_inbound_keys")
    .update({ key_cipher: null, revoked_at: new Date().toISOString(), sequence: body.sequence })
    .or(`grant_id.eq.${body.grant}${body.key_id ? `,key_id.eq.${body.key_id}` : ""}`);
  await logIntegration(null, "permission.revoked", "ok", `${body.name} (${body.reason})`);
}

/** The live key for guest requests, if a hotel has allowed it. */
async function liveKey(): Promise<{ key: string; business: string } | null> {
  const { data } = await db()
    .from("workpeg_inbound_keys")
    .select("business, key_cipher")
    .eq("name", "guest_requests")
    .is("revoked_at", null)
    .not("key_cipher", "is", null)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.key_cipher) return null;
  return { key: unseal(data.key_cipher), business: data.business };
}

/**
 * Add a guest's request to the NEXORA peg's Guest requests table, so it shows
 * on the Board in Workpeg. Column ids are the peg's (peg/ui/pages/board.py).
 */
export async function pushGuestRequestToPeg(req: RequestView): Promise<void> {
  const live = await liveKey();
  if (!live) return;
  const guest = req.guest ? [req.guest.first_name, req.guest.last_name].filter(Boolean).join(" ") : "";
  const note = [req.note?.trim(), `NEXORA guest portal, request ${req.code}`].filter(Boolean).join(" | ");
  const res = await fetch(`${workpegConfig().apiBase}/v1/inbound/rows/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${live.key}`,
      "Idempotency-Key": `nexora-${req.id}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        title: req.quantity > 1 ? `${req.title} x${req.quantity}` : req.title,
        room: req.room?.number ?? "",
        department: req.department_id,
        priority: req.priority,
        status: "new",
        guest,
        note,
        source: "guest_form",
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const ok = res.status === 201 || res.status === 200;
  await logIntegration(
    req.hotel_id,
    "peg.inbound_row",
    ok ? "ok" : "error",
    ok ? `${req.code} added to the peg's Guest requests` : `${req.code}: Workpeg answered ${res.status}`,
  );
}
