// Workpeg integration (server side).
//
// 1. Sign in with Workpeg: OpenID Connect, see src/lib/workpeg-oidc.ts and
//    src/app/auth/workpeg/*.
// 2. Tables mirror: every request is copied into a Workpeg table ("NEXORA
//    Requests") over the REST API, using the server-only WORKPEG_PK key. That lets
//    Workpeg AI and the hotel's Workpeg workspace see live operations.
// 3. Bridge: src/app/api/workpeg/actions lets the NEXORA peg's function (workpeg/)
//    call into NEXORA when Workpeg AI uses one of the manifest actions.
//
// Every call is logged to integration_events, which Settings > Integrations shows.
import { db } from "./db";
import { DEPARTMENT_LABEL, STATUS_LABEL } from "./labels";

export interface WorkpegConfig {
  apiBase: string;
  issuer: string;
  appUrl: string;
  clientId: string | null;
  clientSecret: string | null;
  pk: string | null;
  businessId: string | null;
  requestsTable: string | null;
  bridgeSecret: string | null;
  signInEnabled: boolean;
  tablesEnabled: boolean;
  bridgeEnabled: boolean;
}

export function workpegConfig(): WorkpegConfig {
  const env = (name: string) => process.env[name]?.trim() || null;
  const clientId = env("WORKPEG_CLIENT_ID");
  const pk = env("WORKPEG_PK");
  const businessId = env("WORKPEG_BUSINESS_ID");
  const bridgeSecret = env("NEXORA_BRIDGE_SECRET");
  return {
    apiBase: (env("WORKPEG_API_BASE") ?? "https://api.workpeg.com").replace(/\/$/, ""),
    issuer: env("WORKPEG_ISSUER") ?? "https://api.workpeg.com",
    appUrl: (env("APP_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
    clientId,
    clientSecret: env("WORKPEG_CLIENT_SECRET"),
    pk,
    businessId,
    requestsTable: env("WORKPEG_REQUESTS_TABLE"),
    bridgeSecret,
    signInEnabled: Boolean(clientId),
    tablesEnabled: Boolean(pk && businessId),
    bridgeEnabled: Boolean(bridgeSecret),
  };
}

export async function logIntegration(
  hotelId: string | null,
  event: string,
  result: "ok" | "error" | "blocked" | "skipped",
  detail?: string,
): Promise<void> {
  await db()
    .from("integration_events")
    .insert({ hotel_id: hotelId, provider: "workpeg", event, result, detail: detail?.slice(0, 500) ?? null });
}

class WorkpegHttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function workpegFetch<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const cfg = workpegConfig();
  if (!cfg.pk) throw new Error("WORKPEG_PK is not set");
  const res = await fetch(`${cfg.apiBase}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${cfg.pk}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  if (!res.ok) {
    const hint =
      res.status === 401
        ? "token invalid or expired"
        : res.status === 403
          ? "peg not installed in this business, or not its table"
          : text.slice(0, 200);
    throw new WorkpegHttpError(`Workpeg ${init.method} ${path} -> ${res.status}: ${hint}`, res.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

const REQUEST_COLUMNS = [
  { id: "code", name: "Code", type: "text", required: true },
  { id: "room", name: "Room", type: "text" },
  { id: "service", name: "Request", type: "text" },
  { id: "status", name: "Status", type: "text" },
  { id: "priority", name: "Priority", type: "text" },
  { id: "department", name: "Department", type: "text" },
  { id: "assignee", name: "Assigned to", type: "text" },
  { id: "source", name: "Source", type: "text" },
  { id: "sent_at", name: "Sent", type: "datetime", metadata: { type: "datetime" } },
  { id: "updated_at", name: "Updated", type: "datetime", metadata: { type: "datetime" } },
  { id: "feedback", name: "Guest feedback", type: "text" },
].map((c, i) => ({ ...c, position: (i + 1) * 1000 }));

/** The Workpeg table that mirrors requests: from env, from app_settings, or created now. */
async function requestsTableId(hotelId: string): Promise<string> {
  const cfg = workpegConfig();
  if (cfg.requestsTable) return cfg.requestsTable;
  const { data } = await db().from("app_settings").select("value").eq("key", "workpeg_requests_table").maybeSingle();
  const saved = (data?.value as { uuid?: string } | undefined)?.uuid;
  if (saved) return saved;

  const created = await workpegFetch<{ uuid: string }>(`/v1/businesses/${cfg.businessId}/tables/`, {
    method: "POST",
    body: {
      name: "NEXORA Requests",
      alias: "nexora-requests",
      namespace: "nexora",
      columns: REQUEST_COLUMNS,
    },
  });
  await db()
    .from("app_settings")
    .upsert({ key: "workpeg_requests_table", value: { uuid: created.uuid }, updated_at: new Date().toISOString() });
  await logIntegration(hotelId, "Created the Workpeg table “NEXORA Requests”", "ok", created.uuid);
  return created.uuid;
}

interface RequestForSync {
  id: string;
  code: string;
  hotel_id: string;
  title: string;
  status: keyof typeof STATUS_LABEL;
  priority: string;
  department_id: string;
  source: string;
  created_at: string;
  updated_at: string;
  guest_feedback: string | null;
  room: { number: string } | null;
  assignee: { full_name: string } | null;
}

/** Copy one request into the Workpeg "NEXORA Requests" table (insert or full update). */
export async function syncRequestToWorkpeg(requestId: string): Promise<void> {
  const cfg = workpegConfig();
  if (!cfg.tablesEnabled) return;

  const { data } = await db()
    .from("requests")
    .select(
      "id, code, hotel_id, title, status, priority, department_id, source, created_at, updated_at, guest_feedback, room:rooms(number), assignee:staff(full_name)",
    )
    .eq("id", requestId)
    .maybeSingle();
  const req = data as unknown as RequestForSync | null;
  if (!req) return;

  try {
    const table = await requestsTableId(req.hotel_id);
    const row = {
      code: req.code,
      room: req.room?.number ?? "",
      service: req.title,
      status: STATUS_LABEL[req.status] ?? req.status,
      priority: req.priority,
      department: DEPARTMENT_LABEL[req.department_id] ?? req.department_id,
      assignee: req.assignee?.full_name ?? "",
      source: req.source,
      sent_at: req.created_at,
      updated_at: req.updated_at,
      feedback: req.guest_feedback ?? "",
    };

    const { data: link } = await db()
      .from("workpeg_links")
      .select("row_id, table_uuid")
      .eq("entity", "request")
      .eq("entity_id", req.id)
      .maybeSingle();

    if (link && link.table_uuid === table) {
      await workpegFetch(`/v1/businesses/${cfg.businessId}/tables/${table}/rows/${link.row_id}/`, {
        method: "PATCH",
        body: { data: row },
      });
      await db()
        .from("workpeg_links")
        .update({ synced_at: new Date().toISOString() })
        .eq("entity", "request")
        .eq("entity_id", req.id);
      await logIntegration(req.hotel_id, `${req.code} updated in Workpeg (${row.status})`, "ok");
    } else {
      const created = await workpegFetch<{ id: number }>(`/v1/businesses/${cfg.businessId}/tables/${table}/rows/`, {
        method: "POST",
        body: { data: row, position: Math.floor(Date.now() / 1000) },
      });
      await db().from("workpeg_links").upsert({
        entity: "request",
        entity_id: req.id,
        table_uuid: table,
        row_id: created.id,
        synced_at: new Date().toISOString(),
      });
      await logIntegration(req.hotel_id, `${req.code} saved to the Workpeg “NEXORA Requests” table`, "ok");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const blocked = err instanceof WorkpegHttpError && (err.status === 400 || err.status === 403);
    await logIntegration(req.hotel_id, `Sync failed for ${req.code}`, blocked ? "blocked" : "error", message);
  }
}
