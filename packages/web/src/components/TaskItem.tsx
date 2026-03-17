import { useState, useRef, useEffect } from "react";
import { Trash2, MessageSquare, Hash, Pencil } from "lucide-react";
import { type TaskEntry } from "@gmd/shared";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface Props {
  task: TaskEntry;
  onDelete: () => void;
  onUpdate?: (data: Partial<TaskEntry>) => void;
}

export default function TaskItem({ task, onDelete, onUpdate }: Props) {
  const { t, locale } = useI18n();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.description);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleEditSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== task.description && onUpdate) {
      onUpdate({ description: trimmed });
    }
    setEditing(false);
  };

  const handleEditCancel = () => {
    setEditValue(task.description);
    setEditing(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="group flex items-start gap-3 py-2.5 px-3.5 rounded-xl bg-bg-elevated border border-border hover:border-border-hover transition-colors"
    >
      <MessageSquare size={14} className="text-text-tertiary mt-0.5 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={editRef}
            type="text"
            className="input !py-1 !px-2 !text-sm"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEditSave();
              if (e.key === "Escape") handleEditCancel();
            }}
            onBlur={handleEditSave}
          />
        ) : (
          <p
            className={cn("text-sm leading-snug", onUpdate && "cursor-pointer")}
            onClick={() => { if (onUpdate) setEditing(true); }}
          >
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-text-tertiary">
            {new Date(task.timestamp).toLocaleTimeString(locale === "tr" ? "tr-TR" : [], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {task.tags.length > 0 && task.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] text-text-tertiary font-medium">
              <Hash size={8} />{tag}
            </span>
          ))}
        </div>
      </div>

      {onUpdate && !editing && (
        <button
          onClick={() => setEditing(true)}
          aria-label={t("task.edit" as any)}
          className="p-1.5 rounded-lg transition-all flex-shrink-0 text-text-tertiary hover:text-accent hover:bg-accent-soft opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Pencil size={14} />
        </button>
      )}

      <button
        onClick={handleDelete}
        aria-label={confirmDelete ? t("task.confirmDelete") : t("task.deleteNote")}
        className={cn(
          "p-1.5 rounded-lg transition-all flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          confirmDelete
            ? "bg-danger-soft text-danger opacity-100"
            : "text-text-tertiary hover:text-danger hover:bg-danger-soft"
        )}
      >
        <Trash2 size={14} />
      </button>
    </motion.div>
  );
}
