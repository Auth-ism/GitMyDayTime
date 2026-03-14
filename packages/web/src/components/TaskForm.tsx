import { useState, useRef, useEffect } from "react";
import { Plus, Clock, Zap, ListTodo } from "lucide-react";
import { CATEGORY_LABELS, type Category } from "@gmd/shared";
import { cn } from "@/lib/cn";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onSubmit: (data: { description: string; category: Category; duration?: number; tags: string[]; scheduledTime?: string }) => void;
  loading?: boolean;
  type: "task" | "plan";
}

const categories = Object.entries(CATEGORY_LABELS) as [Category, string][];

export default function TaskForm({ onSubmit, loading, type }: Props) {
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<Category>("dev");
  const [dur, setDur] = useState("");
  const [time, setTime] = useState("");
  const [justAdded, setJustAdded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPlan = type === "plan";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || loading) return;
    const duration = dur ? parseDur(dur) : undefined;
    onSubmit({
      description: desc.trim(),
      category: isPlan ? cat : "other",
      duration,
      tags: [],
      ...(isPlan && time ? { scheduledTime: time } : {}),
    });
    setDesc("");
    setDur("");
    setTime("");
    setJustAdded(true);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (justAdded) {
      const t = setTimeout(() => setJustAdded(false), 2000);
      return () => clearTimeout(t);
    }
  }, [justAdded]);

  const Icon = isPlan ? ListTodo : Zap;

  return (
    <form onSubmit={handleSubmit} className="card space-y-3" aria-label={isPlan ? "Add a plan item" : "Log an activity"}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} className="text-text-tertiary" />
        <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
          {isPlan ? "Plan" : "Activity Log"}
        </span>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <label htmlFor={`input-${type}`} className="sr-only">
            {isPlan ? "What will you do?" : "What did you do?"}
          </label>
          <input
            ref={inputRef}
            id={`input-${type}`}
            className="input"
            placeholder={isPlan ? "What will you do?" : "What did you do?"}
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

      {/* Category pills — only for plan items */}
      {isPlan && (
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
      )}

      {/* Time + Duration row */}
      <div className="flex items-center gap-3">
        {isPlan && (
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-text-tertiary flex-shrink-0" />
            <label htmlFor={`time-${type}`} className="sr-only">Scheduled time</label>
            <input
              id={`time-${type}`}
              type="time"
              className="input !w-28 !text-sm"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          {!isPlan && <Clock size={14} className="text-text-tertiary flex-shrink-0" />}
          <label htmlFor={`dur-${type}`} className="sr-only">Duration</label>
          <input
            id={`dur-${type}`}
            className="input !w-36 !text-sm"
            placeholder={isPlan ? "Est. duration: 1h 30m" : "Duration: 1h 30m"}
            value={dur}
            onChange={(e) => setDur(e.target.value)}
          />
        </div>
      </div>

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

function parseDur(s: string): number {
  const m = s.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?$/);
  if (!m) return parseInt(s) || 0;
  return (parseInt(m[1] || "0") * 60) + parseInt(m[2] || "0");
}
