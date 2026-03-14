import { useState } from "react";
import { Check, Trash2, Clock } from "lucide-react";
import { type TaskEntry, formatDuration } from "@gmd/shared";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface Props {
  task: TaskEntry;
  onToggle: () => void;
  onDelete: () => void;
}

export default function TaskItem({ task, onToggle, onDelete }: Props) {
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
        "group flex items-center gap-3 py-3 px-4 rounded-xl transition-colors",
        "bg-bg-elevated border border-border hover:border-border-hover"
      )}
    >
      <button
        onClick={onToggle}
        role="checkbox"
        aria-checked={task.completed}
        aria-label={`Mark "${task.description}" as ${task.completed ? "incomplete" : "complete"}`}
        className={cn(
          "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
          task.completed
            ? "bg-accent border-accent"
            : "border-border-hover hover:border-accent"
        )}
      >
        {task.completed && <Check size={12} className="text-bg" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-snug", task.completed && "line-through text-text-tertiary")}>
          {task.description}
        </p>
        <div className="flex items-center gap-2.5 mt-1">
          {task.duration != null && task.duration > 0 && (
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <Clock size={11} />
              {formatDuration(task.duration)}
            </span>
          )}
          <span className="text-xs text-text-tertiary">
            {new Date(task.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      <button
        onClick={handleDelete}
        aria-label={confirmDelete ? `Confirm delete "${task.description}"` : `Delete "${task.description}"`}
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
