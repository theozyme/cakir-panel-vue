import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiRequest, AUTH_UNAUTHORIZED_EVENT } from "@/lib/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

type SessionResponse = {
  authenticated: boolean;
  username?: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [username, setUsername] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    setUsername(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    let active = true;

    apiRequest<SessionResponse>("/api/auth/session")
      .then((session) => {
        if (!active) return;
        if (session.authenticated) {
          setUsername(session.username ?? null);
          setStatus("authenticated");
        } else {
          clearSession();
        }
      })
      .catch(() => {
        if (active) clearSession();
      });

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, clearSession);
    return () => {
      active = false;
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, clearSession);
    };
  }, [clearSession]);

  const login = useCallback(async (loginUsername: string, password: string) => {
    const session = await apiRequest<SessionResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: loginUsername, password }),
    });
    setUsername(session.username ?? loginUsername);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({ status, username, login, logout }),
    [login, logout, status, username],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
