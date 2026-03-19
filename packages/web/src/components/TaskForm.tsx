import { useState, useRef, useEffect } from "react";
import { Plus, Clock, Timer, MessageSquare, ListTodo, Bell } from "lucide-react";
import { parseDuration, DEFAULT_CATEGORIES, type Category, type ItemType, type PriorityType } from "@gmd/shared";
import { useI18n, useCategoryLabel } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onSubmit: (data: { description: string; category: Category; duration?: number; tags: string[]; scheduledTime?: string; itemType?: ItemType; priority?: PriorityType }) => void;
  loading?: boolean;
  type: "task" | "plan" | "reminder";
}

const categoryKeys: string[] = [...DEFAULT_CATEGORIES];

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
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<Category>("dev");
  const [dur, setDur] = useState("");
  const [durMinutes, setDurMinutes] = useState<number | null>(null);
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<PriorityType>("normal");
  const [justAdded, setJustAdded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPlan = type === "plan";
  const isReminder = type === "reminder";

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
    <form onSubmit={handleSubmit} className="card space-y-3" aria-label={isPlan ? t("form.addPlan") : isReminder ? t("reminder.add" as any) : t("form.addNote")}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} className="text-text-tertiary" />
        <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
          {isPlan ? t("form.plan") : isReminder ? t("reminder.title" as any) : t("form.quickNotes")}
        </span>
      </div>

      {/* Description + Add button */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor={`input-${type}`} className="sr-only">
            {isPlan ? t("form.whatWillYouDo") : isReminder ? t("reminder.placeholder" as any) : t("form.addNotePlace")}
          </label>
          <input
            ref={inputRef}
            id={`input-${type}`}
            className="input"
            placeholder={isPlan ? t("form.whatWillYouDo") : isReminder ? t("reminder.placeholder" as any) : t("form.addNotePlace")}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !desc.trim()}
          className={cn("btn btn-primary", loading && "animate-pulse")}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{t("form.add")}</span>
        </button>
      </div>

      {/* Time — only for reminders (required) */}
      {isReminder && (
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-text-tertiary flex-shrink-0" />
          <span className="text-xs text-text-tertiary">{t("form.start")}</span>
          <input
            type="time"
            className="input !w-[7.5rem] !text-sm !py-1.5"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>
      )}

      {isPlan && (
        <>
          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
            {categoryKeys.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={cat === key}
                onClick={() => setCat(key)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                  cat === key
                    ? "bg-accent text-bg shadow-sm"
                    : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text border border-transparent hover:border-border"
                )}
              >
                {getCatLabel(key)}
              </button>
            ))}
          </div>

          {/* Priority */}
          <div className="flex items-center gap-2" role="group" aria-label="Priority">
            <span className="text-xs text-text-tertiary">Oncelik:</span>
            {(["normal", "high", "urgent"] as PriorityType[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-all border",
                  priority === p
                    ? p === "urgent"
                      ? "bg-red-500 text-white border-red-500"
                      : p === "high"
                      ? "bg-orange-400 text-white border-orange-400"
                      : "bg-accent text-bg border-accent"
                    : "bg-bg-secondary text-text-secondary border-transparent hover:border-border"
                )}
              >
                {p === "urgent" ? "Acil" : p === "high" ? "Yuksek" : "Normal"}
              </button>
            ))}
          </div>

          {/* When & How long */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-text-tertiary flex-shrink-0" />
              <span className="text-xs text-text-tertiary">{t("form.start")}</span>
              <label htmlFor={`time-${type}`} className="sr-only">{t("form.start")}</label>
              <input
                id={`time-${type}`}
                type="time"
                className="input !w-[7.5rem] !text-sm !py-1.5"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Timer size={14} className="text-text-tertiary flex-shrink-0" />
              <span className="text-xs text-text-tertiary">{t("form.duration")}</span>
              {QUICK_DURATIONS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectQuickDuration(value)}
                  className={cn(
                    "px-2 py-1 rounded-md text-xs font-medium transition-all",
                    durMinutes === value
                      ? "bg-accent text-bg"
                      : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary border border-transparent hover:border-border"
                  )}
                >
                  {label}
                </button>
              ))}
              <label htmlFor={`dur-${type}`} className="sr-only">{t("form.custom")}</label>
              <input
                id={`dur-${type}`}
                className="input !w-20 !text-xs !py-1.5"
                placeholder={t("form.custom")}
                value={dur}
                onChange={(e) => { setDur(e.target.value); setDurMinutes(null); }}
              />
            </div>
          </div>
        </>
      )}

      {/* Success feedback */}
      <AnimatePresence>
        {justAdded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-success font-medium flex items-center gap-1"
            role="status"
            aria-live="polite"
          >
            {t("form.addedSuccess")}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
