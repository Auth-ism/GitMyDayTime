import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "gmd-theme";

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

// Read once at module load — the provider's effect writes this key back on mount,
// so this is the only chance to tell "chosen on this device" from "fresh device".
const bootStoredTheme: Theme | null =
  typeof window === "undefined" ? null : (localStorage.getItem(STORAGE_KEY) as Theme | null);

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
  hadStoredTheme: boolean;
}>({ theme: "system", toggle: () => {}, setTheme: () => {}, hadStoredTheme: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => bootStoredTheme || "system");

  useEffect(() => {
    const apply = () => {
      document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
    };
    apply();
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  const toggle = () => setThemeState((t) => {
    const resolved = resolveTheme(t);
    return resolved === "light" ? "dark" : "light";
  });
  const setTheme = (t: Theme) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme, hadStoredTheme: bootStoredTheme !== null }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
