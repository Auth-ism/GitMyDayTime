import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface AuthContext {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContext>({
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ ok: false }),
  logout: () => {},
});

const TOKEN_KEY = "gmd-token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check existing token on mount
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) {
      setIsLoading(false);
      return;
    }

    fetch("/api/auth/check", {
      headers: { Authorization: `Bearer ${saved}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          setToken(saved);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { ok: false, error: data.error || "Login failed" };
      }

      const { token: newToken } = await res.json();
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      return { ok: true };
    } catch {
      return { ok: false, error: "Connection failed" };
    }
  }, []);

  const logout = useCallback(() => {
    if (token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
