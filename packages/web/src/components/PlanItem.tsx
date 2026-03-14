import { useState } from "react";
import { Check, Trash2, Clock, Timer } from "lucide-react";
import { type PlanItem as PlanItemType, CATEGORY_LABELS, formatDuration, parseDuration } from "@gmd/shared";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

interface Props {
  item: PlanItemType;
  onToggle: (actualDuration?: number) => void;
  onUpdate?: (data: Partial<PlanItemType>) => void;
  onDelete: () => void;
}

export default function PlanItem({ item, onToggle, onUpdate, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDuration, setShowDuration] = useState(false);
  const [actualDur, setActualDur] = useState("");

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleToggle = () => {
    if (!item.completed) {
      // Show duration input before completing
      setShowDuration(true);
    } else {
      // Uncomplete
      onToggle();
    }
  };

  const handleComplete = () => {
    const duration = actualDur ? parseDuration(actualDur) : undefined;
    onToggle(duration);
    setShowDuration(false);
    setActualDur("");
  };

  const handleSkipDuration = () => {
    onToggle();
    setShowDuration(false);
    setActualDur("");
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "group flex flex-col rounded-xl transition-colors",
        "bg-bg-elevated border border-border hover:border-border-hover",
        item.completed && "opacity-70"
      )}
    >
      <div className="flex items-center gap-3 py-2.5 px-3.5">
        <button
          onClick={handleToggle}
          role="checkbox"
          aria-checked={item.completed}
          aria-label={`Mark "${item.description}" as ${item.completed ? "incomplete" : "complete"}`}
          className={cn(
            "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
            item.completed
              ? "bg-success border-success"
              : "border-border-hover hover:border-accent"
          )}
        >
          {item.completed && <Check size={12} className="text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={cn("text-sm leading-snug", item.completed && "line-through text-text-tertiary")}>
            {item.description}
          </p>
          <div className="flex items-center gap-2.5 mt-0.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-bg-secondary text-text-secondary">
              {CATEGORY_LABELS[item.category]}
            </span>
            {item.scheduledTime && (
              <span className="flex items-center gap-1 text-xs text-text-secondary font-medium">
                <Clock size={11} />
                {item.scheduledTime}
              </span>
            )}
            {item.estimatedDuration != null && item.estimatedDuration > 0 && (
              <span className="flex items-center gap-1 text-xs text-text-tertiary">
                ~{formatDuration(item.estimatedDuration)}
              </span>
            )}
            {item.actualDuration != null && item.actualDuration > 0 && (
              <span className="flex items-center gap-1 text-xs text-success">
                <Timer size={11} />
                {formatDuration(item.actualDuration)}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleDelete}
          aria-label={confirmDelete ? `Confirm delete "${item.description}"` : `Delete "${item.description}"`}
          className={cn(
            "p-1.5 rounded-lg transition-all flex-shrink-0",
            confirmDelete
              ? "bg-danger-soft text-danger"
              : "text-text-tertiary hover:text-danger hover:bg-danger-soft focus-visible:text-danger"
          )}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Actual duration input when completing */}
      <AnimatePresence>
        {showDuration && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3 pt-1 flex items-center gap-2 border-t border-border">
              <Timer size={14} className="text-text-tertiary flex-shrink-0" />
              <input
                type="text"
                className="input !w-28 !text-sm"
                placeholder="1h 30m"
                value={actualDur}
                onChange={(e) => setActualDur(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleComplete();
                  if (e.key === "Escape") { setShowDuration(false); setActualDur(""); }
                }}
              />
              <button onClick={handleComplete} className="btn btn-primary !py-1.5 !px-3 text-xs">
                Done
              </button>
              <button onClick={handleSkipDuration} className="btn btn-ghost !py-1.5 !px-2 text-xs text-text-tertiary">
                Skip
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

