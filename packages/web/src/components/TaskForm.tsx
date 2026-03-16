import { useState, useRef, useEffect } from "react";
import { Plus, Clock, Timer, MessageSquare, ListTodo, Hash, X } from "lucide-react";
import { parseDuration, type Category } from "@gmd/shared";
import { useI18n, useCategoryLabel } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onSubmit: (data: { description: string; category: Category; duration?: number; tags: string[]; scheduledTime?: string }) => void;
  loading?: boolean;
  type: "task" | "plan";
}

const categoryKeys: Category[] = ["dev", "meeting", "review", "ops", "learning", "personal", "other"];

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
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [justAdded, setJustAdded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPlan = type === "plan";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || loading) return;
    const duration = isPlan ? (durMinutes ?? (dur ? parseDuration(dur) : undefined)) : undefined;
    onSubmit({
      description: desc.trim(),
      category: isPlan ? cat : "other",
      duration,
      tags: isPlan ? [] : tags,
      ...(isPlan && time ? { scheduledTime: time } : {}),
    });
    setDesc("");
    setDur("");
    setDurMinutes(null);
    setTime("");
    setTags([]);
    setTagInput("");
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

  const Icon = isPlan ? ListTodo : MessageSquare;

  return (
    <form onSubmit={handleSubmit} className="card space-y-3" aria-label={isPlan ? t("form.addPlan") : t("form.addNote")}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} className="text-text-tertiary" />
        <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
          {isPlan ? t("form.plan") : t("form.quickNotes")}
        </span>
      </div>

      {/* Description + Add button */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor={`input-${type}`} className="sr-only">
            {isPlan ? t("form.whatWillYouDo") : t("form.addNotePlace")}
          </label>
          <input
            ref={inputRef}
            id={`input-${type}`}
            className="input"
            placeholder={isPlan ? t("form.whatWillYouDo") : t("form.addNotePlace")}
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

      {/* Tags — only for quick notes */}
      {!isPlan && (
        <div className="flex items-center gap-2 flex-wrap">
          <Hash size={14} className="text-text-tertiary flex-shrink-0" />
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-secondary text-xs font-medium text-text-secondary border border-border"
            >
              {tag}
              <button
                type="button"
                onClick={() => setTags((t) => t.filter((x) => x !== tag))}
                className="text-text-tertiary hover:text-danger"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            type="text"
            className="bg-transparent outline-none text-xs placeholder:text-text-tertiary w-20"
            placeholder={t("form.addTag")}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                e.preventDefault();
                const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
                if (tag && !tags.includes(tag)) {
                  setTags((t) => [...t, tag]);
                }
                setTagInput("");
              }
              if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                setTags((t) => t.slice(0, -1));
              }
            }}
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
