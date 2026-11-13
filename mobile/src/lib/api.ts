import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// Talks to the NEXORA web app's /api/mobile routes.
//
// Server address, in order:
//   1. one saved on the sign-in screen (e.g. the Vercel URL for the demo)
//   2. EXPO_PUBLIC_API_URL from mobile/.env
//   3. the laptop running `expo start`, on port 3000 (Expo Go knows its IP)

const SERVER_KEY = "nexora.server";
const SESSION_KEY = "nexora.session";

export interface StaffProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string | null;
  on_duty: boolean;
}

export interface Session {
  token: string;
  refreshToken: string;
  expiresAt: number;
  staff: StaffProfile;
  hotel: { name: string; shortName: string; accent: string; timezone: string; currency: string };
}

export interface Task {
  id: string;
  code: string;
  title: string;
  quantity: number;
  note: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  source: string;
  sourceLabel: string;
  status: string;
  statusLabel: string;
  departmentId: string;
  room: { number: string; floor: number; landmark: string | null } | null;
  service: { name: string; icon: string; category: string } | null;
  guestFirstName: string | null;
  assignee: { id: string; name: string } | null;
  due: { kind: "none" | "ok" | "soon" | "overdue"; label: string };
  waitingLabel: string | null;
  createdAt: string;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TaskLists {
  staff: { id: string; name: string; departmentId: string | null; role: string; onDuty: boolean };
  todo: Task[];
  doing: Task[];
  done: Task[];
  pool: Task[];
}

export interface TaskDetail {
  task: Task;
  events: { id: number; at: string; message: string }[];
  otherRequestsFromRoom: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function defaultServer(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:3000` : "http://localhost:3000";
}

export async function getServer(): Promise<string> {
  return (await SecureStore.getItemAsync(SERVER_KEY)) ?? defaultServer();
}

export async function setServer(url: string | null): Promise<void> {
  const clean = url?.trim().replace(/\/+$/, "");
  if (clean) await SecureStore.setItemAsync(SERVER_KEY, clean);
  else await SecureStore.deleteItemAsync(SERVER_KEY);
}

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

async function saveSession(s: Session | null): Promise<void> {
  if (s) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  return call<T>(path, { method: "POST", body: JSON.stringify(body) }, token);
}

async function call<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  const server = await getServer();
  let res: Response;
  try {
    res = await fetch(`${server}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new ApiError(`Can't reach NEXORA at ${server}. Check the server address and that your phone is on the same Wi-Fi.`, 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const s = await post<Session>("/api/mobile/login", { email, password });
  await saveSession(s);
  return s;
}

/** Demo mode only: one tap opens the app as a seeded staff member (e.g. "amaka"). */
export async function signInDemo(who: string): Promise<Session> {
  const s = await post<Session>("/api/mobile/login", { demo: who });
  await saveSession(s);
  return s;
}

export interface ServerConfig {
  hotel: { name: string; shortName: string };
  demo: boolean;
  workpegSignIn: boolean;
}

export async function getConfig(): Promise<ServerConfig> {
  return call<ServerConfig>("/api/mobile/config", { method: "GET" });
}

export async function signOut(): Promise<void> {
  await saveSession(null);
}

/** Calls an authenticated route, refreshing the access token once if it has expired. */
async function authed<T>(path: string, init: RequestInit = { method: "GET" }): Promise<T> {
  let s = await loadSession();
  if (!s) throw new ApiError("Sign in to continue.", 401);
  const nearlyExpired = s.expiresAt && s.expiresAt * 1000 - Date.now() < 60_000;
  if (nearlyExpired) s = await refresh(s);
  try {
    return await call<T>(path, init, s.token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      s = await refresh(s);
      return call<T>(path, init, s.token);
    }
    throw err;
  }
}

async function refresh(s: Session): Promise<Session> {
  try {
    const next = await post<Session>("/api/mobile/login", { refreshToken: s.refreshToken });
    await saveSession(next);
    return next;
  } catch (err) {
    await saveSession(null);
    throw err instanceof ApiError ? new ApiError(err.message, 401) : err;
  }
}

export const api = {
  tasks: () => authed<TaskLists>("/api/mobile/tasks"),
  task: (id: string) => authed<TaskDetail>(`/api/mobile/tasks/${id}`),
  act: (id: string, action: "claim" | "start" | "complete" | "handback", extra: { note?: string; followUp?: boolean; reason?: string } = {}) =>
    authed<{ ok: true; message: string; task: Task | null }>(`/api/mobile/tasks/${id}`, {
      method: "POST",
      body: JSON.stringify({ action, ...extra }),
    }),
  setDuty: (onDuty: boolean) =>
    authed<{ ok: true; onDuty: boolean; message: string }>("/api/mobile/duty", { method: "POST", body: JSON.stringify({ onDuty }) }),
};
