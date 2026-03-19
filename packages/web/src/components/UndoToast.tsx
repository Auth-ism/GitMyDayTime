import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  onUndo: () => void;
}

let _setToast: ((t: Toast | null) => void) | null = null;
let _timeoutId: ReturnType<typeof setTimeout> | null = null;

export function showUndoToast(message: string, onUndo: () => void) {
  if (_timeoutId) clearTimeout(_timeoutId);
  const id = Math.random().toString(36).slice(2);
  _setToast?.({ id, message, onUndo });
  _timeoutId = setTimeout(() => {
    _setToast?.(null);
  }, 4000);
}

export function cancelUndoToast() {
  if (_timeoutId) {
    clearTimeout(_timeoutId);
    _timeoutId = null;
  }
  _setToast?.(null);
}

export function UndoToastContainer() {
  const [toast, setToast] = useState<Toast | null>(null);
  _setToast = setToast;

  const handleUndo = useCallback(() => {
    if (_timeoutId) clearTimeout(_timeoutId);
    _timeoutId = null;
    const undo = toast?.onUndo;
    setToast(null);
    undo?.();
  }, [toast]);

  const handleDismiss = useCallback(() => {
    if (_timeoutId) clearTimeout(_timeoutId);
    _timeoutId = null;
    setToast(null);
  }, []);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-bg-elevated border border-border rounded-xl shadow-lg px-4 py-3 text-sm min-w-[240px] max-w-xs"
          role="status"
          aria-live="polite"
        >
          <span className="flex-1 text-text">{toast.message}</span>
          <button
            onClick={handleUndo}
            className="text-accent font-medium hover:underline whitespace-nowrap"
          >
            Geri Al
          </button>
          <button
            onClick={handleDismiss}
            className="text-text-tertiary hover:text-text p-0.5"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useUndoDelete({
  onDeletePlan,
  onDeleteTask,
  onDeleteReminder,
}: {
  onDeletePlan: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onDeleteReminder: (id: string) => void;
}) {
  const pendingRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const deletePlanWithUndo = useCallback(
    (id: string, description: string, restore: () => void) => {
      showUndoToast(`"${description}" silindi`, () => {
        const t = pendingRef.current.get(id);
        if (t) {
          clearTimeout(t);
          pendingRef.current.delete(id);
        }
        restore();
      });
      const t = setTimeout(() => {
        pendingRef.current.delete(id);
        onDeletePlan(id);
      }, 4000);
      pendingRef.current.set(id, t);
    },
    [onDeletePlan]
  );

  const deleteTaskWithUndo = useCallback(
    (id: string, description: string, restore: () => void) => {
      showUndoToast(`"${description}" silindi`, () => {
        const t = pendingRef.current.get(id);
        if (t) {
          clearTimeout(t);
          pendingRef.current.delete(id);
        }
        restore();
      });
      const t = setTimeout(() => {
        pendingRef.current.delete(id);
        onDeleteTask(id);
      }, 4000);
      pendingRef.current.set(id, t);
    },
    [onDeleteTask]
  );

  const deleteReminderWithUndo = useCallback(
    (id: string, description: string, restore: () => void) => {
      showUndoToast(`"${description}" silindi`, () => {
        const t = pendingRef.current.get(id);
        if (t) {
          clearTimeout(t);
          pendingRef.current.delete(id);
        }
        restore();
      });
      const t = setTimeout(() => {
        pendingRef.current.delete(id);
        onDeleteReminder(id);
      }, 4000);
      pendingRef.current.set(id, t);
    },
    [onDeleteReminder]
  );

  return { deletePlanWithUndo, deleteTaskWithUndo, deleteReminderWithUndo };
}
