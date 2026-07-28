import { useState, useRef } from "react";
import { Check, Trash2, Clock, Timer, Play, Pencil, Plus, ListChecks, ChevronDown, ChevronUp, Repeat, X } from "lucide-react";
import { type PlanItem as PlanItemType, type ChecklistItem, type PriorityType, formatDuration } from "@gmd/shared";
import { useI18n, useCategoryLabel } from "@/lib/i18n";
import { useCategories } from "@/hooks/useCategories";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

const PRIORITY_COLORS: Record<PriorityType, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-400",
  normal: "",
};

const PRIORITY_BORDER: Record<PriorityType, string> = {
  urgent: "border-l-2 border-l-red-500",
  high: "border-l-2 border-l-orange-400",
  normal: "",
};

interface Props {
  item: PlanItemType;
  onToggle: (actualDuration?: number) => void;
  onRequestComplete?: () => void;
  onDelete: () => void;
  onRequestEdit?: () => void;
  onMakeRecurring?: () => void;
  onStartPomodoro?: () => void;
  onAddChecklist?: (description: string) => void;
  onUpdateChecklist?: (clId: string, data: Partial<ChecklistItem>) => void;
  onDeleteChecklist?: (clId: string) => void;
  dragHandle?: React.ReactNode;
}

export default function PlanItem({
  item, onToggle, onRequestComplete, onDelete, onRequestEdit, onMakeRecurring, onStartPomodoro,
  onAddChecklist, onUpdateChecklist, onDeleteChecklist, dragHandle,
}: Props) {
  const { t } = useI18n();
  const getCatLabel = useCategoryLabel();
  const { getCategoryColor } = useCategories();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [editingClId, setEditingClId] = useState<string | null>(null);
  const [editingClText, setEditingClText] = useState("");
  const checkInputRef = useRef<HTMLInputElement>(null);

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
      onRequestComplete ? onRequestComplete() : onToggle();
    } else {
      onToggle();
    }
  };

  const handleAddCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCheckItem.trim();
    if (trimmed && onAddChecklist) {
      onAddChecklist(trimmed);
      setNewCheckItem("");
    }
  };

  // Sorted locally so an optimistic order swap reorders the list immediately,
  // without waiting for the refetch.
  const checklist = [...(item.checklist || [])].sort((a, b) => a.order - b.order);
  const checkDone = checklist.filter((c) => c.completed).length;
  const hasChecklist = checklist.length > 0 || onAddChecklist;

  // Reorder by swapping the two rows' order values — one call per row.
  const moveCheck = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= checklist.length) return;
    const current = checklist[index];
    const neighbour = checklist[target];
    onUpdateChecklist?.(current.id, { order: neighbour.order });
    onUpdateChecklist?.(neighbour.id, { order: current.order });
  };

  const startRename = (cl: ChecklistItem) => {
    setEditingClId(cl.id);
    setEditingClText(cl.description);
  };

  const commitRename = () => {
    if (!editingClId) return;
    const trimmed = editingClText.trim();
    const original = checklist.find((c) => c.id === editingClId);
    if (trimmed && trimmed !== original?.description) {
      onUpdateChecklist?.(editingClId, { description: trimmed });
    }
    setEditingClId(null);
  };

  const priority = item.priority ?? "normal";

  return (
    <div
      className={cn(
        "group flex flex-col rounded-xl transition-colors",
        "bg-bg-elevated border border-border hover:border-border-hover",
        item.completed && "opacity-70",
        PRIORITY_BORDER[priority]
      )}
    >
      <div className="flex items-center gap-3 py-2.5 px-3.5">
        <button
          onClick={handleToggle}
          onPointerDown={(e) => e.stopPropagation()}
          role="checkbox"
          aria-checked={item.completed}
          aria-label={t("plan.markAs", { desc: item.description, status: item.completed ? t("plan.incomplete") : t("plan.complete") })}
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
          <div className="flex items-center gap-1.5">
            {priority !== "normal" && (
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", PRIORITY_COLORS[priority])} />
            )}
            <p
              className={cn("text-sm leading-snug", item.completed && "line-through text-text-tertiary", onRequestEdit && !item.completed && "cursor-pointer")}
              onClick={() => { if (onRequestEdit && !item.completed) onRequestEdit(); }}
            >
              {item.description}
            </p>
          </div>

          <div className="flex items-center gap-2.5 mt-0.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-bg-secondary text-text-secondary">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(item.category) }} />
              {getCatLabel(item.category)}
            </span>
            {item.scheduledTime && (
              <span className="flex items-center gap-1 text-xs text-text-secondary font-medium">
                <Clock size={11} />
                {item.scheduledTime}
              </span>
            )}
            {item.duration != null && item.duration > 0 && (
              <span className="flex items-center gap-1 text-xs text-text-tertiary">
                ~{formatDuration(item.duration)}
              </span>
            )}
            {item.actualDuration != null && item.actualDuration > 0 && (
              <span className="flex items-center gap-1 text-xs text-success">
                <Timer size={11} />
                {formatDuration(item.actualDuration)}
              </span>
            )}
            {checklist.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent transition-colors"
              >
                <ListChecks size={11} />
                <span>{checkDone}/{checklist.length}</span>
                <ChevronDown size={10} className={cn("transition-transform", expanded && "rotate-180")} />
              </button>
            )}
          </div>
        </div>

        {!item.completed && onRequestEdit && (
          <button
            onClick={onRequestEdit}
            aria-label="Edit"
            className="p-1.5 rounded-lg transition-all flex-shrink-0 text-text-tertiary hover:text-accent hover:bg-accent-soft"
          >
            <Pencil size={14} />
          </button>
        )}

        {!item.completed && onAddChecklist && checklist.length === 0 && (
          <button
            onClick={() => { setExpanded(true); setTimeout(() => checkInputRef.current?.focus(), 100); }}
            aria-label="Add checklist"
            className="p-1.5 rounded-lg transition-all flex-shrink-0 text-text-tertiary hover:text-accent hover:bg-accent-soft opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Plus size={14} />
          </button>
        )}

        {!item.completed && onMakeRecurring && (
          <button
            onClick={onMakeRecurring}
            aria-label={t("recurring.makeRecurring" as any)}
            title={t("recurring.makeRecurring" as any)}
            className="p-1.5 rounded-lg transition-all flex-shrink-0 text-text-tertiary hover:text-accent hover:bg-accent-soft"
          >
            <Repeat size={14} />
          </button>
        )}

        {!item.completed && onStartPomodoro && (
          <button
            onClick={onStartPomodoro}
            aria-label={t("plan.startPomodoro", { desc: item.description })}
            className="p-1.5 rounded-lg transition-all flex-shrink-0 text-text-tertiary hover:text-accent hover:bg-accent-soft"
          >
            <Play size={14} />
          </button>
        )}

        {dragHandle}

        <button
          onClick={handleDelete}
          aria-label={confirmDelete ? t("plan.confirmDelete", { desc: item.description }) : t("plan.delete", { desc: item.description })}
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

      {/* Checklist */}
      <AnimatePresence>
        {expanded && hasChecklist && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-2.5 pt-1 border-t border-border/50 space-y-1">
              {checklist.map((cl, index) => (
                <div key={cl.id} className="flex items-start gap-2 group/cl py-0.5">
                  <button
                    onClick={() => onUpdateChecklist?.(cl.id, { completed: !cl.completed })}
                    className={cn(
                      "w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all",
                      cl.completed ? "bg-success border-success" : "border-border-hover hover:border-accent"
                    )}
                  >
                    {cl.completed && <Check size={8} className="text-white" />}
                  </button>

                  {editingClId === cl.id ? (
                    <input
                      autoFocus
                      type="text"
                      className="flex-1 min-w-0 text-xs bg-transparent outline-none border-b border-accent pb-0.5"
                      value={editingClText}
                      onChange={(e) => setEditingClText(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                        if (e.key === "Escape") { e.preventDefault(); setEditingClId(null); }
                      }}
                    />
                  ) : (
                    <span
                      onDoubleClick={() => startRename(cl)}
                      className={cn("text-xs flex-1 min-w-0 break-words", cl.completed && "line-through text-text-tertiary")}
                    >
                      {cl.description}
                    </span>
                  )}

                  {editingClId === cl.id ? (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setEditingClId(null)}
                      aria-label={t("edit.cancel" as any)}
                      className="p-0.5 text-text-tertiary hover:text-text flex-shrink-0"
                    >
                      <X size={11} />
                    </button>
                  ) : (
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover/cl:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={() => moveCheck(index, -1)}
                        disabled={index === 0}
                        aria-label={t("checklist.moveUp" as any)}
                        title={t("checklist.moveUp" as any)}
                        className="p-0.5 text-text-tertiary hover:text-accent disabled:opacity-30 disabled:hover:text-text-tertiary"
                      >
                        <ChevronUp size={11} />
                      </button>
                      <button
                        onClick={() => moveCheck(index, 1)}
                        disabled={index === checklist.length - 1}
                        aria-label={t("checklist.moveDown" as any)}
                        title={t("checklist.moveDown" as any)}
                        className="p-0.5 text-text-tertiary hover:text-accent disabled:opacity-30 disabled:hover:text-text-tertiary"
                      >
                        <ChevronDown size={11} />
                      </button>
                      <button
                        onClick={() => startRename(cl)}
                        aria-label={t("checklist.rename" as any)}
                        title={t("checklist.rename" as any)}
                        className="p-0.5 text-text-tertiary hover:text-accent"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => onDeleteChecklist?.(cl.id)}
                        aria-label={t("checklist.delete" as any)}
                        title={t("checklist.delete" as any)}
                        className="p-0.5 text-text-tertiary hover:text-danger"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {onAddChecklist && (
                <form onSubmit={handleAddCheck} className="flex items-center gap-2 pt-0.5">
                  <Plus size={12} className="text-text-tertiary flex-shrink-0" />
                  <input
                    ref={checkInputRef}
                    type="text"
                    className="flex-1 text-xs bg-transparent outline-none placeholder:text-text-tertiary py-0.5"
                    placeholder={t("checklist.add" as any)}
                    value={newCheckItem}
                    onChange={(e) => setNewCheckItem(e.target.value)}
                  />
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
