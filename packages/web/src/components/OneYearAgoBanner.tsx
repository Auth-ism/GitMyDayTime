import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n, useCategoryLabel } from "@/lib/i18n";
import { cn } from "@/lib/cn";

interface Props {
  date: string;
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function OneYearAgoBanner({ date }: Props) {
  const { t, locale } = useI18n();
  const getCatLabel = useCategoryLabel();
  const [expanded, setExpanded] = useState(false);

  const { data } = useQuery({
    queryKey: ["one-year-ago", date],
    queryFn: () => api.getOneYearAgo(date),
    staleTime: 5 * 60_000,
  });

  const plan = data?.plan ?? [];
  if (plan.length === 0) return null;

  const totalMins = plan.reduce((sum, p) => sum + (p.actualDuration ?? p.duration ?? 0), 0);
  const completedCount = plan.filter((p) => p.completed).length;

  const displayDate = data?.date
    ? new Date(data.date + "T12:00:00").toLocaleDateString(
        locale === "tr" ? "tr-TR" : "en-US",
        { year: "numeric", month: "long", day: "numeric" },
      )
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="card !py-2.5 border-border bg-bg-secondary/40"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 text-left"
        aria-expanded={expanded}
      >
        <CalendarClock size={15} className="text-text-tertiary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-secondary">
            {t("oneYearAgo.title" as any)}
          </p>
          <p className="text-[11px] text-text-tertiary truncate">
            {displayDate} · {t("oneYearAgo.summary" as any, {
              count: plan.length,
              completed: completedCount,
              duration: totalMins > 0 ? formatDuration(totalMins) : "—",
            })}
          </p>
        </div>
        {expanded
          ? <ChevronUp size={14} className="text-text-tertiary flex-shrink-0" />
          : <ChevronDown size={14} className="text-text-tertiary flex-shrink-0" />}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <ul className="mt-2 pt-2 border-t border-border/50 space-y-1">
              {plan.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 text-xs text-text-secondary"
                >
                  <span
                    className={cn(
                      "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
                      p.completed ? "bg-success" : "bg-text-tertiary/40",
                    )}
                  />
                  <span className={cn("flex-1 truncate", p.completed && "line-through text-text-tertiary")}>
                    {p.description}
                  </span>
                  <span className="text-[10px] text-text-tertiary flex-shrink-0">
                    {getCatLabel(p.category)}
                  </span>
                  {(p.actualDuration ?? p.duration) && (
                    <span className="text-[10px] text-text-tertiary tabular-nums flex-shrink-0">
                      {formatDuration(p.actualDuration ?? p.duration ?? 0)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
