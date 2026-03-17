import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useI18n, useDayLabels } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { useSwipe } from "@/hooks/useSwipe";

export default function CalendarPage() {
  const { t, locale } = useI18n();
  const dayLabels = useDayLabels();
  const dateLoc = locale === "tr" ? "tr-TR" : "en-US";
  const [current, setCurrent] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const navigate = useNavigate();

  const from = `${current.year}-${String(current.month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(current.year, current.month + 1, 0).getDate();
  const to = `${current.year}-${String(current.month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: stats } = useQuery({
    queryKey: ["stats", from, to],
    queryFn: () => api.getStats(from, to),
  });

  const activityMap = useMemo(() => {
    const map: Record<string, { total: number; tasks: number; planned: number }> = {};
    stats?.dailyActivity.forEach((d) => {
      map[d.date] = { total: d.tasks + d.planned, tasks: d.tasks, planned: d.planned };
    });
    return map;
  }, [stats]);

  const firstDayOfWeek = new Date(current.year, current.month, 1).getDay();
  const days = Array.from({ length: lastDay }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  const prev = () =>
    setCurrent((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }));
  const next = () =>
    setCurrent((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }));

  const goToday = () => {
    const now = new Date();
    setCurrent({ year: now.getFullYear(), month: now.getMonth() });
  };

  const swipeHandlers = useSwipe({ onSwipeLeft: next, onSwipeRight: prev });
  const monthName = new Date(current.year, current.month).toLocaleDateString(dateLoc, { month: "long", year: "numeric" });
  const today = new Date().toISOString().split("T")[0];
  const isCurrentMonth = current.year === new Date().getFullYear() && current.month === new Date().getMonth();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Calendar size={20} className="text-text-secondary" />
          {t("cal.title")}
        </h1>
        <div className="flex items-center gap-1.5">
          {!isCurrentMonth && (
            <button onClick={goToday} className="btn btn-ghost text-xs mr-1">{t("day.today")}</button>
          )}
          <button onClick={prev} className="btn btn-ghost p-2" aria-label={t("cal.prevMonth")}>
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium w-40 text-center" aria-live="polite">{monthName}</span>
          <button onClick={next} className="btn btn-ghost p-2" aria-label={t("cal.nextMonth")}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="card" role="grid" aria-label={`${t("cal.title")} ${monthName}`} {...swipeHandlers}>
        <div className="grid grid-cols-7 gap-1.5 mb-2" role="row">
          {dayLabels.map((d) => (
            <div key={d} role="columnheader" className="text-xs text-text-tertiary text-center font-medium py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {blanks.map((i) => <div key={`b-${i}`} aria-hidden="true" />)}
          {days.map((day) => {
            const dateStr = `${current.year}-${String(current.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const activity = activityMap[dateStr];
            const count = activity?.total || 0;
            const isToday = dateStr === today;
            const isFuture = dateStr > today;

            return (
              <motion.button
                key={day}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/day/${dateStr}`)}
                aria-label={`${new Date(dateStr + "T12:00:00").toLocaleDateString(dateLoc, { month: "long", day: "numeric" })}${count > 0 ? `, ${t("cal.activities", { count })}` : ""}`}
                className={cn(
                  "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-sm transition-all relative p-1",
                  isToday && "ring-2 ring-accent",
                  isFuture && "opacity-50",
                  count > 0
                    ? "bg-bg-elevated border border-border hover:border-border-hover hover:shadow-sm"
                    : "hover:bg-bg-tertiary"
                )}
              >
                <span className={cn(
                  "text-xs leading-none",
                  isToday ? "font-bold" : count > 0 ? "font-medium" : "text-text-tertiary"
                )}>
                  {day}
                </span>
                {count > 0 && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          i < (activity?.tasks || 0) ? "bg-accent" : "bg-text-tertiary/40"
                        )}
                      />
                    ))}
                    {count > 4 && <span className="text-[8px] text-text-tertiary">+</span>}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: stats.daysTracked, label: t("cal.daysTracked") },
            { value: stats.totalTasks, label: t("cal.totalTasks") },
            { value: stats.streak, label: t("cal.dayStreak") },
          ].map(({ value, label }) => (
            <div key={label} className="card text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-text-secondary mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-text-tertiary">
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent" /> {t("cal.tasks")}
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-text-tertiary/40" /> {t("cal.plans")}
        </span>
      </div>
    </div>
  );
}
