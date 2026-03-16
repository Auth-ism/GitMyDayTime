import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { UserResponse, UserProfile } from "@gmd/shared";
import { api } from "./api";

interface AuthContext {
  user: UserResponse | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContext>({
  user: null,
  profile: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const p = await api.getProfile();
      setProfile(p);
    } catch {
      // ignore — profile fetch is best-effort
    }
  }, []);

  // Check existing session on mount
  useEffect(() => {
    fetch("/api/auth/check", { credentials: "include" })
      .then((r) => r.json())
      .then(async (data) => {
        if (data.authenticated && data.user) {
          setUser(data.user);
          await fetchProfile();
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { ok: false, error: data.error || "Login failed" };
      }

      const { user: userData } = await res.json();
      setUser(userData);
      await fetchProfile();
      return { ok: true };
    } catch {
      return { ok: false, error: "Connection failed" };
    }
  }, [fetchProfile]);

  const register = useCallback(async (email: string, username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { ok: false, error: data.error || "Registration failed" };
      }

      const { user: userData } = await res.json();
      setUser(userData);
      await fetchProfile();
      return { ok: true };
    } catch {
      return { ok: false, error: "Connection failed" };
    }
  }, [fetchProfile]);

  const logout = useCallback(() => {
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, isAuthenticated: !!user, isLoading, login, register, logout, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
