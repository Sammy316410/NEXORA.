import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Vibration } from "react-native";
import { api, ApiError, type TaskLists } from "./api";
import { onTasksChanged } from "./refresh";
import { useSession } from "./session";
import { useToast } from "@/components/toaster";

// One live copy of the staff member's tasks and pool, shared by the tabs.
// Polls like the web staff app's auto-refresh (every 7 s while the app is open).
const POLL_MS = 7_000;

interface TasksState {
  data: TaskLists | null;
  error: string | null;
  live: boolean;
  reload: () => Promise<void>;
}

const Ctx = createContext<TasksState | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const { session, expire } = useSession();
  const toast = useToast();
  const [data, setData] = useState<TaskLists | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await api.tasks();
      // New task assigned to me: buzz and toast, like the web staff app.
      const ids = new Set(next.todo.map((t) => t.id));
      if (seen.current) {
        const fresh = next.todo.find((t) => !seen.current!.has(t.id));
        if (fresh) {
          Vibration.vibrate([0, 120, 60, 120]);
          toast(`New task · Room ${fresh.room?.number ?? "?"} · ${fresh.title}`, "info");
        }
      }
      seen.current = ids;
      setData(next);
      setError(null);
      setLive(true);
    } catch (err) {
      setLive(false);
      if (err instanceof ApiError && err.status === 401) return expire();
      setError(err instanceof Error ? err.message : "Couldn't load your tasks.");
    }
  }, [expire, toast]);

  useEffect(() => {
    if (!session) return;
    reload();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") reload();
    }, POLL_MS);
    const off = onTasksChanged(reload);
    const sub = AppState.addEventListener("change", (s) => s === "active" && reload());
    return () => {
      clearInterval(timer);
      off();
      sub.remove();
    };
  }, [session, reload]);

  return <Ctx.Provider value={{ data, error, live, reload }}>{children}</Ctx.Provider>;
}

export function useTasks(): TasksState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTasks must be used inside TasksProvider");
  return v;
}
