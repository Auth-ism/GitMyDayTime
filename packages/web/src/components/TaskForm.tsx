import { useState, useRef, useEffect } from "react";
import { Plus, Clock, Timer, MessageSquare, ListTodo, Bell, ChevronDown } from "lucide-react";
import { parseDuration, type Category, type ItemType, type PriorityType } from "@gmd/shared";
import { useI18n, useCategoryLabel } from "@/lib/i18n";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/cn";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onSubmit: (data: { description: string; category: Category; duration?: number; tags: string[]; scheduledTime?: string; itemType?: ItemType; priority?: PriorityType }) => void;
  loading?: boolean;
  type: "task" | "plan" | "reminder";
}

const QUICK_DURATIONS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "1.5h", value: 90 },
  { label: "2h", value: 120 },
];

export default function TaskForm({ onSubmit, loading, type }: Props) {
  const { t } = useI18n();
  const getCatLabel = useCategoryLabel();
  const { allCategories, createCategory } = useCategories();
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<Category>("dev");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [dur, setDur] = useState("");
  const [durMinutes, setDurMinutes] = useState<number | null>(null);
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<PriorityType>("normal");
  const [justAdded, setJustAdded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const isPlan = type === "plan";
  const isReminder = type === "reminder";

  // Collapse on click outside
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        if (!desc.trim()) setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded, desc]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || loading) return;
    const parsed = dur ? parseDuration(dur) : undefined;
    const duration = isPlan ? (durMinutes ?? (parsed && parsed > 0 ? parsed : undefined)) : undefined;
    onSubmit({
      description: desc.trim(),
      category: isPlan ? cat : "other",
      duration,
      tags: [],
      ...((isPlan || isReminder) && time ? { scheduledTime: time } : {}),
      ...(isReminder ? { itemType: "reminder" as ItemType } : {}),
      ...(isPlan ? { priority } : {}),
    });
    setDesc("");
    setDur("");
    setDurMinutes(null);
    setTime("");
    setPriority("normal");
    setJustAdded(true);
    setExpanded(false);
    inputRef.current?.focus();
  };

  const selectQuickDuration = (mins: number) => {
    if (durMinutes === mins) {
      setDurMinutes(null);
      setDur("");
    } else {
      setDurMinutes(mins);
      setDur("");
    }
  };

  useEffect(() => {
    if (justAdded) {
      const t = setTimeout(() => setJustAdded(false), 2000);
      return () => clearTimeout(t);
    }
  }, [justAdded]);

  const Icon = isPlan ? ListTodo : isReminder ? Bell : MessageSquare;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="card !py-2.5 !px-3" aria-label={isPlan ? t("form.addPlan") : isReminder ? t("reminder.add" as any) : t("form.addNote")}>
      {/* Compact input row */}
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-text-tertiary flex-shrink-0" />
        <input
          ref={inputRef}
          id={`input-${type}`}
          className="flex-1 bg-transparent text-sm text-text placeholder:text-text-tertiary outline-none py-1.5"
          placeholder={isPlan ? t("form.whatWillYouDo") : isReminder ? t("reminder.placeholder" as any) : t("form.addNotePlace")}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onFocus={() => setExpanded(true)}
          autoComplete="off"
        />
        {isPlan && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "p-1 rounded transition-transform text-text-tertiary hover:text-text-secondary",
              expanded && "rotate-180"
            )}
          >
            <ChevronDown size={14} />
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !desc.trim()}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            desc.trim()
              ? "bg-accent text-bg hover:opacity-90"
              : "text-text-tertiary"
          )}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Time — only for reminders (required) */}
      {isReminder && expanded && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
          <Clock size={13} className="text-text-tertiary flex-shrink-0" />
          <span className="text-xs text-text-tertiary">{t("form.start")}</span>
          <input
            type="time"
            className="input !w-[7rem] !text-xs !py-1"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>
      )}

      {/* Expanded plan options */}
      <AnimatePresence>
        {isPlan && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="pt-2 mt-2 border-t border-border space-y-2.5">
              {/* Category + Priority in one row */}
              <div className="flex flex-wrap items-center gap-1">
                {allCategories.map(({ key, label, isCustom }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCat(key)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[11px] font-medium transition-all",
                      cat === key
                        ? "bg-accent text-bg"
                        : "text-text-tertiary hover:text-text-secondary hover:bg-bg-secondary"
                    )}
                  >
                    {isCustom ? label : getCatLabel(key)}
                  </button>
                ))}
                {showNewCat ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (newCatName.trim()) {
                        createCategory.mutate({ name: newCatName.trim(), color: "#6b7280" });
                        setNewCatName("");
                        setShowNewCat(false);
                      }
                    }}
                  >
                    <input
                      autoFocus
                      className="input !w-20 !text-[11px] !py-0.5 !px-1.5"
                      placeholder="Kategori..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onBlur={() => { if (!newCatName.trim()) setShowNewCat(false); }}
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowNewCat(true)}
                    className="px-1.5 py-1 rounded-md text-[11px] text-text-tertiary hover:text-text-secondary hover:bg-bg-secondary transition-all"
                    title="Yeni kategori ekle"
                  >
                    <Plus size={12} />
                  </button>
                )}
                <span className="w-px h-4 bg-border mx-0.5" />
                {(["normal", "high", "urgent"] as PriorityType[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[11px] font-medium transition-all",
                      priority === p
                        ? p === "urgent"
                          ? "bg-red-500 text-white"
                          : p === "high"
                          ? "bg-orange-400 text-white"
                          : "bg-accent text-bg"
                        : "text-text-tertiary hover:text-text-secondary hover:bg-bg-secondary"
                    )}
                  >
                    {t(`priority.${p}` as any)}
                  </button>
                ))}
              </div>

              {/* Time + Duration compact row */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-text-tertiary" />
                  <input
                    type="time"
                    className="input !w-[7rem] !text-xs !py-1"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="Saat"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Timer size={12} className="text-text-tertiary" />
                  {QUICK_DURATIONS.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectQuickDuration(value)}
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[11px] font-medium transition-all",
                        durMinutes === value
                          ? "bg-accent text-bg"
                          : "text-text-tertiary hover:text-text-secondary hover:bg-bg-secondary"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                  <input
                    className="input !w-16 !text-[11px] !py-1"
                    placeholder={t("form.custom")}
                    value={dur}
                    onChange={(e) => { setDur(e.target.value); setDurMinutes(null); }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success feedback */}
      <AnimatePresence>
        {justAdded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[11px] text-success font-medium mt-1"
            role="status"
          >
            {t("form.addedSuccess")}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
