import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import type { Guest, Hotel, Reservation, Room } from "./types";

const COOKIE = "nx_guest";

function secret(): Uint8Array {
  const value = process.env.NEXORA_SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("NEXORA_SESSION_SECRET must be set to 16+ random characters (see .env.example)");
  }
  return new TextEncoder().encode(value);
}

export interface GuestContext {
  reservation: Reservation;
  guest: Guest;
  room: Room;
  hotel: Hotel;
}

export type AccessProblem = "invalid" | "revoked" | "expired" | "checked-out" | "not-arrived";

/** Why a reservation's guest access can't be used right now, or null if it can. */
export function accessProblem(r: Reservation, now = Date.now()): AccessProblem | null {
  if (r.status === "checked_out") return "checked-out";
  if (r.status === "cancelled" || r.status === "no_show") return "invalid";
  if (r.access_revoked_at) return "revoked";
  if (r.access_expires_at && new Date(r.access_expires_at).getTime() < now) return "expired";
  return null;
}

export async function startGuestSession(reservation: Reservation): Promise<void> {
  const expires = reservation.access_expires_at
    ? new Date(reservation.access_expires_at)
    : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ rid: reservation.id, hid: reservation.hotel_id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expires.getTime() / 1000))
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endGuestSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The guest's stay, from the signed session cookie. Null if missing, invalid or ended. */
export const getGuest = cache(async (): Promise<GuestContext | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let rid: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    rid = String(payload.rid);
  } catch {
    return null;
  }
  const { data } = await db()
    .from("reservations")
    .select("*, guest:guests(*), room:rooms(*), hotel:hotels(*)")
    .eq("id", rid)
    .maybeSingle();
  if (!data) return null;
  const { guest, room, hotel, ...reservation } = data as Reservation & { guest: Guest; room: Room; hotel: Hotel };
  if (accessProblem(reservation)) return null;
  return { reservation, guest, room, hotel };
});

export async function requireGuest(): Promise<GuestContext> {
  const ctx = await getGuest();
  if (!ctx) redirect("/guest/ended?reason=signed-out");
  return ctx;
}
