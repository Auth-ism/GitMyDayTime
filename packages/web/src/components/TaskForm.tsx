import { useState, useRef, useEffect } from "react";
import { Plus, Clock, Timer, MessageSquare, ListTodo } from "lucide-react";
import { CATEGORY_LABELS, parseDuration, type Category } from "@gmd/shared";
import { cn } from "@/lib/cn";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onSubmit: (data: { description: string; category: Category; duration?: number; tags: string[]; scheduledTime?: string }) => void;
  loading?: boolean;
  type: "task" | "plan";
}

const categories = Object.entries(CATEGORY_LABELS) as [Category, string][];

const QUICK_DURATIONS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "1.5h", value: 90 },
  { label: "2h", value: 120 },
];

export default function TaskForm({ onSubmit, loading, type }: Props) {
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<Category>("dev");
  const [dur, setDur] = useState("");
  const [durMinutes, setDurMinutes] = useState<number | null>(null);
  const [time, setTime] = useState("");
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
      tags: [],
      ...(isPlan && time ? { scheduledTime: time } : {}),
    });
    setDesc("");
    setDur("");
    setDurMinutes(null);
    setTime("");
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
    <form onSubmit={handleSubmit} className="card space-y-3" aria-label={isPlan ? "Add a plan item" : "Add a note"}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} className="text-text-tertiary" />
        <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
          {isPlan ? "Plan" : "Quick Notes"}
        </span>
      </div>

      {/* Description + Add button */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor={`input-${type}`} className="sr-only">
            {isPlan ? "What will you do?" : "Add a note..."}
          </label>
          <input
            ref={inputRef}
            id={`input-${type}`}
            className="input"
            placeholder={isPlan ? "What will you do?" : "Add a note..."}
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
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      {isPlan && (
        <>
          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
            {categories.map(([key, label]) => (
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
                {label}
              </button>
            ))}
          </div>

          {/* When & How long — inline row */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Start time */}
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-text-tertiary flex-shrink-0" />
              <span className="text-xs text-text-tertiary">Start</span>
              <label htmlFor={`time-${type}`} className="sr-only">Scheduled time</label>
              <input
                id={`time-${type}`}
                type="time"
                className="input !w-[7.5rem] !text-sm !py-1.5"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            {/* Duration — quick chips + manual */}
            <div className="flex items-center gap-2 flex-wrap">
              <Timer size={14} className="text-text-tertiary flex-shrink-0" />
              <span className="text-xs text-text-tertiary">Duration</span>
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
              <label htmlFor={`dur-${type}`} className="sr-only">Custom duration</label>
              <input
                id={`dur-${type}`}
                className="input !w-20 !text-xs !py-1.5"
                placeholder="Custom"
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
            Added successfully
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
