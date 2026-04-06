import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type FontSize = "small" | "normal" | "large" | "xlarge";

const LS_KEY = "gmd-font-size";

const FontSizeContext = createContext<{
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
}>({ fontSize: "normal", setFontSize: () => {} });

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    if (typeof window === "undefined") return "normal";
    return (localStorage.getItem(LS_KEY) as FontSize) || "normal";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-font-size", fontSize);
    localStorage.setItem(LS_KEY, fontSize);
  }, [fontSize]);

  const setFontSize = (s: FontSize) => setFontSizeState(s);

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export const useFontSize = () => useContext(FontSizeContext);
