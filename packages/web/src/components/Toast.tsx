import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, CornerUpLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastType = "error" | "success" | "info" | "undo";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  onUndo?: () => void;
}

// ── Singleton state ──────────────────────────────────────────────
let _addToast: ((t: ToastItem) => void) | null = null;
const _timers = new Map<string, ReturnType<typeof setTimeout>>();

function makeId() {
  return Math.random().toString(36).slice(2);
}

export function showToast(message: string, type: ToastType = "info", duration = 4000) {
  const id = makeId();
  _addToast?.({ id, message, type });
  _timers.set(id, setTimeout(() => _dismissToast?.(id), duration));
}

export function showUndoToast(message: string, onUndo: () => void) {
  const id = makeId();
  _addToast?.({ id, message, type: "undo", onUndo });
  _timers.set(id, setTimeout(() => _dismissToast?.(id), 4000));
}

export function showErrorToast(message: string) {
  showToast(message, "error", 5000);
}

export function showSuccessToast(message: string) {
  showToast(message, "success", 3500);
}

let _dismissToast: ((id: string) => void) | null = null;

// ── Container ────────────────────────────────────────────────────
const MAX_TOASTS = 4;

const ICONS: Record<ToastType, React.FC<{ size?: number; className?: string }>> = {
  error:   AlertCircle,
  success: CheckCircle,
  info:    Info,
  undo:    CornerUpLeft,
};

const ICON_COLORS: Record<ToastType, string> = {
  error:   "text-danger",
  success: "text-green-400",
  info:    "text-accent",
  undo:    "text-accent",
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    const t = _timers.get(id);
    if (t) { clearTimeout(t); _timers.delete(id); }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  _dismissToast = dismiss;
  _addToast = (item: ToastItem) => {
    setToasts(prev => {
      const next = [...prev, item];
      // Keep at most MAX_TOASTS — drop oldest
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
  };

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence mode="sync">
        {toasts.map(toast => {
          const Icon = ICONS[toast.type];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className={cn(
                "pointer-events-auto flex items-center gap-3 bg-bg-elevated border rounded-xl shadow-lg px-4 py-3 text-sm min-w-[260px] max-w-sm",
                toast.type === "error" ? "border-danger/30" : "border-border"
              )}
              role={toast.type === "error" ? "alert" : "status"}
              aria-live={toast.type === "error" ? "assertive" : "polite"}
            >
              <Icon size={15} className={cn("flex-shrink-0", ICON_COLORS[toast.type])} />
              <span className="flex-1 text-text text-xs">{toast.message}</span>
              {toast.type === "undo" && toast.onUndo && (
                <button
                  onClick={() => { toast.onUndo!(); dismiss(toast.id); }}
                  className="text-accent font-medium text-xs hover:underline whitespace-nowrap flex-shrink-0"
                >
                  Geri Al
                </button>
              )}
              <button
                onClick={() => dismiss(toast.id)}
                className="text-text-tertiary hover:text-text p-0.5 flex-shrink-0"
                aria-label="Kapat"
              >
                <X size={13} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
