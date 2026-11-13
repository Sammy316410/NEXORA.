import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { loadSession, signIn as apiSignIn, signInDemo as apiSignInDemo, signOut as apiSignOut, type Session } from "./api";

interface SessionState {
  session: Session | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInDemo: (who: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Called when the server says the session is gone (expired refresh token). */
  expire: () => void;
  /** Keep the stored profile in step after changes like the duty switch. */
  patchStaff: (patch: Partial<Session["staff"]>) => void;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSession()
      .then(setSession)
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setSession(await apiSignIn(email, password));
  }, []);

  const signInDemo = useCallback(async (who: string) => {
    setSession(await apiSignInDemo(who));
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setSession(null);
  }, []);

  const expire = useCallback(() => setSession(null), []);

  const patchStaff = useCallback((patch: Partial<Session["staff"]>) => {
    setSession((s) => (s ? { ...s, staff: { ...s.staff, ...patch } } : s));
  }, []);

  return <Ctx.Provider value={{ session, ready, signIn, signInDemo, signOut, expire, patchStaff }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}
