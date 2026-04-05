import { useState, useRef, useEffect } from "react";
import { Check, Trash2, Clock, Timer, Play, Pencil, Plus, ListChecks, ChevronDown, Bell } from "lucide-react";
import { type PlanItem as PlanItemType, type ChecklistItem, type PriorityType, formatDuration, parseDuration } from "@gmd/shared";
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
  onDelete: () => void;
  onUpdate?: (data: Partial<PlanItemType>) => void;
  onStartPomodoro?: () => void;
  onAddChecklist?: (description: string) => void;
  onUpdateChecklist?: (clId: string, data: Partial<ChecklistItem>) => void;
  onDeleteChecklist?: (clId: string) => void;
}

export default function PlanItem({
  item, onToggle, onDelete, onUpdate, onStartPomodoro,
  onAddChecklist, onUpdateChecklist, onDeleteChecklist,
}: Props) {
  const { t } = useI18n();
  const getCatLabel = useCategoryLabel();
  const { getCategoryColor } = useCategories();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDuration, setShowDuration] = useState(false);
  const [actualDur, setActualDur] = useState("");
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.description);
  const [expanded, setExpanded] = useState(false);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [editPriority, setEditPriority] = useState<PriorityType>(item.priority ?? "normal");
  const [editTime, setEditTime] = useState(item.scheduledTime ?? "");
  const [editDuration, setEditDuration] = useState(item.duration != null && item.duration > 0 ? String(item.duration) : "");
  const editRef = useRef<HTMLInputElement>(null);
  const checkInputRef = useRef<HTMLInputElement>(null);

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

  const handleToggle = () => {
    if (!item.completed) {
      setShowDuration(true);
    } else {
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

  const handleEditSave = () => {
    const trimmed = editValue.trim();
    if (onUpdate) {
      const updates: Partial<PlanItemType> = {};
      if (trimmed && trimmed !== item.description) updates.description = trimmed;
      if (editPriority !== (item.priority ?? "normal")) updates.priority = editPriority;
      // scheduledTime: empty string → null to clear
      const newTime = editTime.trim() || null;
      if (newTime !== (item.scheduledTime ?? null)) updates.scheduledTime = newTime ?? undefined;
      // duration: parse minutes
      const newDur = editDuration.trim() ? Number(editDuration) : null;
      if (!isNaN(newDur ?? 0) && newDur !== (item.duration ?? null)) {
        updates.duration = newDur ?? undefined;
      }
      if (Object.keys(updates).length > 0) onUpdate(updates);
    }
    setEditing(false);
  };

  const handleEditCancel = () => {
    setEditValue(item.description);
    setEditTime(item.scheduledTime ?? "");
    setEditDuration(item.duration != null && item.duration > 0 ? String(item.duration) : "");
    setEditing(false);
  };

  const handleAddCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCheckItem.trim();
    if (trimmed && onAddChecklist) {
      onAddChecklist(trimmed);
      setNewCheckItem("");
    }
  };

  const checklist = item.checklist || [];
  const checkDone = checklist.filter((c) => c.completed).length;
  const hasChecklist = checklist.length > 0 || onAddChecklist;

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
          {editing ? (
            <div className="space-y-1.5">
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
              />
              <div className="flex gap-1.5" role="group" aria-label="Priority">
                {(["normal", "high", "urgent"] as PriorityType[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditPriority(p)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-medium border transition-all",
                      editPriority === p ? "border-accent bg-accent-soft text-text" : "border-border text-text-tertiary"
                    )}
                  >
                    {t(`priority.${p}` as any)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <Clock size={12} className="text-text-tertiary flex-shrink-0" />
                  <input
                    type="time"
                    className="input !py-1 !px-2 !text-xs flex-1"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    placeholder="--:--"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-1">
                  <Timer size={12} className="text-text-tertiary flex-shrink-0" />
                  <input
                    type="number"
                    min={1}
                    max={480}
                    className="input !py-1 !px-2 !text-xs flex-1"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    placeholder={t("plan.durationMin" as any)}
                  />
                </div>
              </div>
              <div className="flex gap-1.5 pt-0.5">
                <button onClick={handleEditSave} className="btn-primary px-3 py-1 text-xs flex-1">{t("form.save" as any)}</button>
                <button onClick={handleEditCancel} className="btn-secondary px-3 py-1 text-xs">{t("issue.cancelEdit" as any)}</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {priority !== "normal" && (
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", PRIORITY_COLORS[priority])} />
              )}
              <p
                className={cn("text-sm leading-snug", item.completed && "line-through text-text-tertiary", onUpdate && "cursor-pointer")}
                onClick={() => { if (onUpdate && !item.completed) { setEditing(true); setEditPriority(item.priority ?? "normal"); setEditTime(item.scheduledTime ?? ""); setEditDuration(item.duration != null && item.duration > 0 ? String(item.duration) : ""); } }}
              >
                {item.description}
              </p>
            </div>
          )}
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

        {!item.completed && onUpdate && !editing && (
          <button
            onClick={() => { setEditing(true); setEditPriority(item.priority ?? "normal"); setEditTime(item.scheduledTime ?? ""); setEditDuration(item.duration != null && item.duration > 0 ? String(item.duration) : ""); }}
            aria-label="Edit"
            className="p-1.5 rounded-lg transition-all flex-shrink-0 text-text-tertiary hover:text-accent hover:bg-accent-soft opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
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

        {!item.completed && onStartPomodoro && (
          <button
            onClick={onStartPomodoro}
            aria-label={t("plan.startPomodoro", { desc: item.description })}
            className="p-1.5 rounded-lg transition-all flex-shrink-0 text-text-tertiary hover:text-accent hover:bg-accent-soft"
          >
            <Play size={14} />
          </button>
        )}

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
              {checklist.map((cl) => (
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
                  <span className={cn("text-xs flex-1", cl.completed && "line-through text-text-tertiary")}>
                    {cl.description}
                  </span>
                  <button
                    onClick={() => onDeleteChecklist?.(cl.id)}
                    className="p-0.5 text-text-tertiary hover:text-danger opacity-0 group-hover/cl:opacity-100 transition-opacity"
                  >
                    <Trash2 size={10} />
                  </button>
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
                {t("plan.done")}
              </button>
              <button onClick={handleSkipDuration} className="btn btn-ghost !py-1.5 !px-2 text-xs text-text-tertiary">
                {t("plan.skip")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
