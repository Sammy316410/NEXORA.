// Realtime "something changed" pings, sent from the server after every write.
//
// Pings carry no guest names, only a request code, room number and status. Each
// screen then re-fetches its own data through the server, which checks the
// session. Screens also poll every few seconds, so nothing breaks if a ping is
// lost or Realtime isn't configured.

export const topics = {
  hotel: (hotelId: string) => `nexora-hotel-${hotelId}`,
  stay: (reservationId: string) => `nexora-stay-${reservationId}`,
};

export interface PingMessage {
  topic: string;
  event?: string;
  payload: Record<string, unknown>;
}

export async function ping(messages: PingMessage[]): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || messages.length === 0) return;

  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: key };
  // Legacy service_role keys are JWTs and also go in Authorization.
  // New sb_secret_ keys are not JWTs and must only be sent as apikey.
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;

  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: messages.map((m) => ({
          topic: m.topic,
          event: m.event ?? "change",
          payload: m.payload,
          private: false,
        })),
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok && process.env.NODE_ENV !== "production") {
      console.warn(`[realtime] broadcast failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.warn("[realtime] broadcast error", err);
  }
}
