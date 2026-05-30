import { useState, useRef, useEffect } from "react";
import { Plus, Clock, MessageSquare, ListTodo, Bell, ChevronDown } from "lucide-react";
import { type Category, type ItemType, type PriorityType } from "@gmd/shared";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/cn";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onSubmit: (data: { description: string; category: Category; duration?: number; tags: string[]; scheduledTime?: string; itemType?: ItemType; priority?: PriorityType }) => void;
  loading?: boolean;
  type: "task" | "plan" | "reminder";
  initialDescription?: string;
  autoFocus?: boolean;
}

export const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#78716c",
];

export default function TaskForm({ onSubmit, loading, type, initialDescription, autoFocus }: Props) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const { allCategories } = useCategories();
  const [desc, setDesc] = useState(initialDescription ?? "");
  const [category, setCategory] = useState<Category>(profile?.defaultCategory || "dev");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [priority, setPriority] = useState<PriorityType>("normal");
  const [expanded, setExpanded] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (initialDescription) {
      setDesc(initialDescription);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [initialDescription]);

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 50);
  }, [autoFocus]);

  // Sync category default with profile
  useEffect(() => {
    if (profile?.defaultCategory) setCategory(profile.defaultCategory);
  }, [profile?.defaultCategory]);

  const isPlan = type === "plan";
  const isReminder = type === "reminder";
  const hasOptions = isPlan || isReminder;

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
    onSubmit({
      description: desc.trim(),
      category: isPlan ? category : "other",
      tags: [],
      ...(time ? { scheduledTime: time } : {}),
      ...(isReminder ? { itemType: "reminder" as ItemType } : {}),
      ...(isPlan ? { priority } : {}),
      ...(isPlan && duration ? { duration: parseInt(duration, 10) } : {}),
    });
    setDesc("");
    setTime("");
    setDuration("");
    setPriority("normal");
    setExpanded(false);
    setJustAdded(true);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (justAdded) {
      const timer = setTimeout(() => setJustAdded(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [justAdded]);

  const Icon = isPlan ? ListTodo : isReminder ? Bell : MessageSquare;

  return (
    <form ref={formRef} onSubmit={handleSubmit} aria-label={isPlan ? t("form.addPlan") : isReminder ? t("reminder.add" as any) : t("form.addNote")}>
      <div className="flex items-center gap-2 px-1">
        <Icon size={14} className="text-text-tertiary flex-shrink-0" />
        <input
          ref={inputRef}
          id={`input-${type}`}
          className="flex-1 bg-transparent text-sm text-text placeholder:text-text-tertiary outline-none py-1.5"
          placeholder={isPlan ? t("form.whatWillYouDo") : isReminder ? t("reminder.placeholder" as any) : t("form.addNotePlace")}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          autoComplete="off"
        />
        {hasOptions && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "p-1 rounded transition-colors",
              expanded ? "text-text" : "text-text-tertiary hover:text-text"
            )}
          >
            <ChevronDown size={14} className={cn("transition-transform duration-150", expanded && "rotate-180")} />
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !desc.trim()}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            desc.trim() ? "bg-accent text-bg hover:opacity-90" : "text-text-tertiary"
          )}
        >
          <Plus size={16} />
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border px-1">
              {isPlan && (
                <div className="flex flex-wrap gap-1.5">
                  {allCategories.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setCategory(cat.key)}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium border transition-all",
                        category === cat.key
                          ? "border-transparent text-white"
                          : "border-border text-text-secondary hover:border-text-tertiary"
                      )}
                      style={category === cat.key ? { backgroundColor: cat.color } : {}}
                    >
                      {cat.isCustom ? cat.label : t(`cat.${cat.key}` as any)}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-text-tertiary flex-shrink-0" />
                  <span className="text-xs text-text-tertiary">{t("form.start")}</span>
                  <input
                    type="time"
                    className="input !w-[7rem] !text-xs !py-1"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required={isReminder}
                  />
                </div>
                {isPlan && (
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-text-tertiary flex-shrink-0" />
                    <span className="text-xs text-text-tertiary">{t("form.duration")}</span>
                    <input
                      type="number"
                      min={1}
                      max={480}
                      className="input !w-[5rem] !text-xs !py-1"
                      placeholder="dk"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                    />
                  </div>
                )}
              </div>
              {isPlan && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary">{t("projects.priority" as any)}</span>
                  {(["urgent", "high", "normal"] as PriorityType[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium border transition-all",
                        priority === p
                          ? p === "urgent" ? "bg-red-500 border-transparent text-white"
                            : p === "high" ? "bg-orange-400 border-transparent text-white"
                            : "bg-accent border-transparent text-bg"
                          : "border-border text-text-secondary hover:border-text-tertiary"
                      )}
                    >
                      {t(`priority.${p}` as any)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {justAdded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[11px] text-success font-medium mt-1 px-1"
            role="status"
          >
            {t("form.addedSuccess")}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
