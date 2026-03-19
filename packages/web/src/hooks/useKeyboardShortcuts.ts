import { useEffect } from "react";

interface Handlers {
  onNote: () => void;
  onPlan: () => void;
  onReminder: () => void;
  onSearch: () => void;
  onHelp: () => void;
}

export function useKeyboardShortcuts(handlers: Handlers) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case "n":
          handlers.onNote();
          break;
        case "p":
          handlers.onPlan();
          break;
        case "r":
          handlers.onReminder();
          break;
        case "/":
          e.preventDefault();
          handlers.onSearch();
          break;
        case "?":
          handlers.onHelp();
          break;
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [handlers]);
}
