import { useState, useRef, useEffect } from "react";
import { Check, Trash2, Clock, Timer, Hourglass, Pencil, Plus, ListChecks, ChevronDown, ChevronUp, Repeat, X } from "lucide-react";
import { type PlanItem as PlanItemType, type ChecklistItem, type PriorityType, formatDuration, parseDuration } from "@gmd/shared";
import { useI18n, useCategoryLabel } from "@/lib/i18n";
import { useCategories } from "@/hooks/useCategories";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import Tooltip from "@/components/Tooltip";

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
  askDurationOnComplete?: boolean;
  onDelete: () => void;
  onUpdate?: (data: Partial<PlanItemType>) => void;
  onMakeRecurring?: () => void;
  onStartPomodoro?: () => void;
  onAddChecklist?: (description: string) => void;
  onUpdateChecklist?: (clId: string, data: Partial<ChecklistItem>) => void;
  onDeleteChecklist?: (clId: string) => void;
  dragHandle?: React.ReactNode;
}

export default function PlanItem({
  item, onToggle, askDurationOnComplete, onDelete, onUpdate, onMakeRecurring, onStartPomodoro,
  onAddChecklist, onUpdateChecklist, onDeleteChecklist, dragHandle,
}: Props) {
  const { t } = useI18n();
  const getCatLabel = useCategoryLabel();
  const { getCategoryColor, allCategories } = useCategories();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.description);
  const [editCategory, setEditCategory] = useState<PlanItemType["category"]>(item.category);
  const [editPriority, setEditPriority] = useState<PriorityType>(item.priority ?? "normal");
  const [editTime, setEditTime] = useState(item.scheduledTime ?? "");
  const [editDuration, setEditDuration] = useState(item.duration != null && item.duration > 0 ? formatDuration(item.duration) : "");
  const [completing, setCompleting] = useState(false);
  const [completeDuration, setCompleteDuration] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const completeRef = useRef<HTMLInputElement>(null);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [editingClId, setEditingClId] = useState<string | null>(null);
  const [editingClText, setEditingClText] = useState("");
  const checkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  const startEdit = () => {
    setEditValue(item.description);
    setEditCategory(item.category);
    setEditPriority(item.priority ?? "normal");
    setEditTime(item.scheduledTime ?? "");
    setEditDuration(item.duration != null && item.duration > 0 ? formatDuration(item.duration) : "");
    setEditing(true);
  };

  const handleEditSave = () => {
    if (onUpdate) {
      const updates: Partial<PlanItemType> = {};
      const trimmed = editValue.trim();
      if (trimmed && trimmed !== item.description) updates.description = trimmed;
      if (editCategory !== item.category) updates.category = editCategory;
      if (editPriority !== (item.priority ?? "normal")) updates.priority = editPriority;
      // empty string clears the scheduled time
      const newTime = editTime.trim() || null;
      if (newTime !== (item.scheduledTime ?? null)) updates.scheduledTime = newTime ?? undefined;
      const newDur = editDuration.trim() ? parseDuration(editDuration) || null : null;
      if (newDur !== (item.duration ?? null)) updates.duration = newDur ?? undefined;
      if (Object.keys(updates).length > 0) onUpdate(updates);
    }
    setEditing(false);
  };

  const handleEditCancel = () => setEditing(false);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  // Completing asks for the actual duration inline, on the item itself.
  const handleToggle = () => {
    if (!item.completed && askDurationOnComplete) {
      setCompleteDuration("");
      setCompleting(true);
      setTimeout(() => completeRef.current?.focus({ preventScroll: true }), 50);
      return;
    }
    onToggle();
  };

  const confirmComplete = (withDuration: boolean) => {
    const raw = completeDuration.trim();
    onToggle(withDuration && raw ? parseDuration(raw) : undefined);
    setCompleting(false);
    setCompleteDuration("");
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
  // While an inline form is open the row's action icons would crowd it out.
  const busy = editing || completing;

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
          {completing ? (
            <div className="space-y-1.5">
              <p className="text-sm leading-snug truncate">{item.description}</p>
              <div className="flex items-center gap-1.5">
                <Timer size={13} className="text-text-tertiary flex-shrink-0" />
                <input
                  ref={completeRef}
                  type="text"
                  className="input !py-1 !px-2 !text-xs flex-1 min-w-0"
                  placeholder="1h 30m"
                  value={completeDuration}
                  onChange={(e) => setCompleteDuration(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmComplete(true);
                    if (e.key === "Escape") { setCompleting(false); setCompleteDuration(""); }
                  }}
                />
                <button onClick={() => confirmComplete(false)} className="btn btn-ghost !py-1 !px-2 text-xs text-text-tertiary flex-shrink-0">
                  {t("plan.skip")}
                </button>
                <button onClick={() => confirmComplete(true)} className="btn btn-primary !py-1 !px-3 text-xs flex-shrink-0">
                  {t("plan.done")}
                </button>
              </div>
            </div>
          ) : editing ? (
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
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("form.category" as any)}>
                {allCategories.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setEditCategory(cat.key)}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all",
                      editCategory === cat.key
                        ? "border-transparent text-white"
                        : "border-border text-text-secondary hover:border-text-tertiary"
                    )}
                    style={editCategory === cat.key ? { backgroundColor: cat.color } : {}}
                  >
                    {cat.isCustom ? cat.label : t(`cat.${cat.key}` as any)}
                  </button>
                ))}
              </div>
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
                    type="text"
                    inputMode="text"
                    className="input !py-1 !px-2 !text-xs flex-1 min-w-0"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    placeholder={t("tip.durationHint" as any)}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-0.5">
                <button onClick={handleEditCancel} className="btn btn-ghost !py-1 !px-3 text-xs text-text-tertiary">{t("issue.cancelEdit" as any)}</button>
                <button onClick={handleEditSave} className="btn btn-primary !py-1 !px-4 text-xs">{t("form.save" as any)}</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {priority !== "normal" && (
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", PRIORITY_COLORS[priority])} />
              )}
              <p
                className={cn("text-sm leading-snug", item.completed && "line-through text-text-tertiary", onUpdate && !item.completed && "cursor-pointer")}
                onClick={() => { if (onUpdate && !item.completed) startEdit(); }}
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

        {!busy && !item.completed && onAddChecklist && checklist.length === 0 && (
          <Tooltip label={t("tip.addStep" as any)}>
            <button
              onClick={() => { setExpanded(true); setTimeout(() => checkInputRef.current?.focus(), 100); }}
              aria-label={t("tip.addStep" as any)}
              className="p-1.5 rounded-lg transition-all flex-shrink-0 text-text-tertiary hover:text-accent hover:bg-accent-soft"
            >
              <Plus size={14} />
            </button>
          </Tooltip>
        )}

        {!busy && !item.completed && onUpdate && (
          <Tooltip label={t("tip.edit" as any)}>
            <button
              onClick={startEdit}
              aria-label={t("tip.edit" as any)}
              className="p-1.5 rounded-lg transition-all flex-shrink-0 text-text-tertiary hover:text-accent hover:bg-accent-soft"
            >
              <Pencil size={14} />
            </button>
          </Tooltip>
        )}

        {!busy && !item.completed && onMakeRecurring && (
          <Tooltip label={t("tip.makeRecurring" as any)}>
            <button
              onClick={onMakeRecurring}
              aria-label={t("recurring.makeRecurring" as any)}
              className="p-1.5 rounded-lg transition-all flex-shrink-0 text-text-tertiary hover:text-accent hover:bg-accent-soft"
            >
              <Repeat size={14} />
            </button>
          </Tooltip>
        )}

        {!busy && !item.completed && onStartPomodoro && (
          <Tooltip label={t("tip.pomodoro" as any)}>
            <button
              onClick={onStartPomodoro}
              aria-label={t("plan.startPomodoro", { desc: item.description })}
              className="p-1.5 rounded-lg transition-all flex-shrink-0 text-text-tertiary hover:text-accent hover:bg-accent-soft"
            >
              <Hourglass size={14} />
            </button>
          </Tooltip>
        )}

        {!busy && dragHandle}

        {!busy && (
          <Tooltip align="right" label={confirmDelete ? t("tip.deleteConfirm" as any) : t("tip.delete" as any)}>
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
          </Tooltip>
        )}
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
