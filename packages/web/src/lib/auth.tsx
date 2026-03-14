import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { UserResponse } from "@gmd/shared";

interface AuthContext {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContext>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    fetch("/api/auth/check", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

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
      return { ok: true };
    } catch {
      return { ok: false, error: "Connection failed" };
    }
  }, []);

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
      return { ok: true };
    } catch {
      return { ok: false, error: "Connection failed" };
    }
  }, []);

  const logout = useCallback(() => {
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
