import {
  dropRevokedKey,
  PermissionError,
  rememberDelivery,
  storeGrantedKey,
  verifyDelivery,
} from "@/lib/workpeg-permissions";

// Workpeg's callback for the NEXORA peg's inbound permission:
// {APP_URL}/api/workpeg/permissions. Workpeg sets this address on its side and
// signs every delivery with WORKPEG_PERMISSION_SECRET. A non-2xx answer to a
// grant makes Workpeg revoke the key at once, so every failure answers an error.
const MAX_BODY = 16 * 1024;

export async function POST(request: Request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY) {
    return Response.json({ ok: false, error: "Body too large" }, { status: 413 });
  }
  try {
    const body = verifyDelivery(request.headers, raw);
    await rememberDelivery(body.delivery);
    if (body.event === "permission.granted") await storeGrantedKey(body);
    else if (body.event === "permission.revoked") await dropRevokedKey(body);
    else return Response.json({ ok: false, error: "Unknown event" }, { status: 400 });
    return Response.json({ ok: true });
  } catch (err) {
    const status = err instanceof PermissionError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Failed";
    console.error("[workpeg permissions]", status, message);
    return Response.json({ ok: false, error: message }, { status });
  }
}

export function GET() {
  return Response.json({ ok: false, error: "POST only" }, { status: 405 });
}
