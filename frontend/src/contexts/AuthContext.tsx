import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { AuthUser } from "../types/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (redirectUrl?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/auth/session`, {
        credentials: "include",
      });
      if (!resp.ok) {
        setUser(null);
        return;
      }
      const data = await resp.json();
      const payload = data.user;
      setUser({
        userId: payload.user_id,
        email: payload.email,
        name: payload.name,
        roles: payload.roles ?? [],
        expiresAt: payload.expires_at,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to auth service");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  const login = useCallback(
    async (redirectUrl?: string) => {
      const target = redirectUrl ?? window.location.href;
      const resp = await fetch(`${API_BASE}/auth/login?redirect=${encodeURIComponent(target)}`, {
        credentials: "include",
      });
      if (!resp.ok) {
        throw new Error("Unable to start login flow");
      }
      const data = await resp.json();
      window.location.assign(data.authorization_url);
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      logout,
      refresh: fetchSession,
    }),
    [user, loading, error, login, logout, fetchSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}