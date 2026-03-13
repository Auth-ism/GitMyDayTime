import { useState } from "react";
import { Check, Trash2, Clock } from "lucide-react";
import { type PlanItem as PlanItemType, CATEGORY_LABELS, formatDuration } from "@gmd/shared";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface Props {
  item: PlanItemType;
  onToggle: () => void;
  onDelete: () => void;
}

export default function PlanItem({ item, onToggle, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "group flex items-center gap-3 py-2.5 px-3.5 rounded-xl transition-colors",
        "bg-bg-elevated border border-border hover:border-border-hover",
        item.completed && "opacity-70"
      )}
    >
      <button
        onClick={onToggle}
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
          {item.estimatedDuration != null && item.estimatedDuration > 0 && (
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <Clock size={11} />
              ~{formatDuration(item.estimatedDuration)}
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
    </motion.div>
  );
}
