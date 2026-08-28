import { useState, useMemo, useRef, useLayoutEffect } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useI18n, useDayLabels } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { animate, motion, useMotionValue, type PanInfo } from "framer-motion";

function addMonths(current: { year: number; month: number }, delta: number) {
  const d = new Date(current.year, current.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function getMonthDays(year: number, month: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    lastDay,
    blanks: Array.from({ length: new Date(year, month, 1).getDay() }, (_, i) => i),
    days: Array.from({ length: lastDay }, (_, i) => i + 1),
  };
}

export default function CalendarPage() {
  const { t, locale } = useI18n();
  const dayLabels = useDayLabels();
  const dateLoc = locale === "tr" ? "tr-TR" : "en-US";
  const [current, setCurrent] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const summaryAnimatedRef = useRef(false);
  const slidingRef = useRef(false);
  const calendarViewportRef = useRef<HTMLDivElement>(null);
  const calendarWidthRef = useRef(0);
  const [calendarWidth, setCalendarWidth] = useState(0);
  const calendarX = useMotionValue(0);
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const viewport = calendarViewportRef.current;
    if (!viewport) return;

    const syncWidth = () => {
      const width = viewport.clientWidth;
      if (!width || width === calendarWidthRef.current) return;
      calendarWidthRef.current = width;
      setCalendarWidth(width);
      if (!slidingRef.current) calendarX.set(-width);
    };

    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [calendarX]);

  const from = `${current.year}-${String(current.month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(current.year, current.month + 1, 0).getDate();
  const to = `${current.year}-${String(current.month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: stats } = useQuery({
    queryKey: ["stats", from, to],
    queryFn: () => api.getStats(from, to),
    placeholderData: (previousData) => previousData,
  });

  const activityMap = useMemo(() => {
    const map: Record<string, { total: number; tasks: number; planned: number }> = {};
    stats?.dailyActivity.forEach((d) => {
      map[d.date] = { total: d.tasks + d.planned, tasks: d.tasks, planned: d.planned };
    });
    return map;
  }, [stats]);

  const currentMonthDays = getMonthDays(current.year, current.month);
  const adjacentMonths = [addMonths(current, -1), current, addMonths(current, 1)];

  const paginate = async (direction: -1 | 1) => {
    const width = calendarWidthRef.current;
    if (slidingRef.current || !width) return;
    slidingRef.current = true;
    calendarX.stop();
    const target = direction === 1 ? -width * 2 : 0;
    const animation = animate(calendarX, target, { type: "spring", stiffness: 420, damping: 38 });
    await (animation as typeof animation & { finished: Promise<unknown> }).finished;
    flushSync(() => {
      setCurrent((c) => addMonths(c, direction));
      calendarX.set(-width);
    });
    slidingRef.current = false;
  };
  const prev = () => { void paginate(-1); };
  const next = () => { void paginate(1); };
  const goToday = () => {
    const now = new Date();
    calendarX.stop();
    if (calendarWidthRef.current) calendarX.set(-calendarWidthRef.current);
    setCurrent({ year: now.getFullYear(), month: now.getMonth() });
  };

  const monthName = new Date(current.year, current.month).toLocaleDateString(dateLoc, { month: "long", year: "numeric" });
  const today = new Date().toISOString().split("T")[0];
  const isCurrentMonth = current.year === new Date().getFullYear() && current.month === new Date().getMonth();
  const shouldAnimateSummary = !summaryAnimatedRef.current;
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
  const handleCalendarDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const width = calendarWidthRef.current;
    if (!isMobile || slidingRef.current || !width) return;
    const threshold = Math.max(70, width * 0.2);
    if (info.offset.x <= -threshold || info.velocity.x <= -500) {
      void paginate(1);
    } else if (info.offset.x >= threshold || info.velocity.x >= 500) {
      void paginate(-1);
    } else {
      slidingRef.current = true;
      calendarX.stop();
      void (animate(calendarX, -width, { type: "spring", stiffness: 420, damping: 38 }) as ReturnType<typeof animate> & { finished: Promise<unknown> }).finished
        .finally(() => { slidingRef.current = false; });
    }
  };
  const renderMonthGrid = (month: { year: number; month: number }, interactive: boolean) => {
    const { blanks, days } = month.year === current.year && month.month === current.month
      ? currentMonthDays
      : getMonthDays(month.year, month.month);

    return (
      <div className="card h-full" role={interactive ? "grid" : undefined} aria-label={interactive ? `${t("cal.title")} ${monthName}` : undefined}>
        <div className="grid grid-cols-7 gap-1.5 mb-2" role={interactive ? "row" : undefined}>
          {dayLabels.map((d) => (
            <div key={d} role={interactive ? "columnheader" : undefined} className="text-xs text-text-tertiary text-center font-medium py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {blanks.map((i) => <div key={`b-${i}`} aria-hidden="true" />)}
          {days.map((day) => {
            const dateStr = `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const activity = interactive ? activityMap[dateStr] : undefined;
            const count = activity?.total || 0;
            const isToday = dateStr === today;
            const isFuture = dateStr > today;

            return (
              <motion.button
                key={day}
                whileHover={interactive ? { scale: 1.05 } : undefined}
                whileTap={interactive ? { scale: 0.97 } : undefined}
                onClick={interactive ? () => navigate(`/day/${dateStr}`) : undefined}
                disabled={!interactive}
                tabIndex={interactive ? 0 : -1}
                aria-label={interactive ? `${new Date(dateStr + "T12:00:00").toLocaleDateString(dateLoc, { month: "long", day: "numeric" })}${count > 0 ? `, ${t("cal.activities", { count })}` : ""}` : undefined}
                className={cn(
                  "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-sm transition-all relative p-1",
                  isToday && "ring-2 ring-accent",
                  isFuture && "opacity-50",
                  count > 0
                    ? "bg-bg-elevated border border-border hover:border-border-hover hover:shadow-sm"
                    : "hover:bg-bg-tertiary",
                  !interactive && "pointer-events-none opacity-50"
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
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <button
            onClick={() => navigate("/week")}
            className="btn-icon p-1.5 rounded-lg -ml-1"
            aria-label={t("nav.week" as any)}
          >
            <Calendar size={20} />
          </button>
          {t("cal.title")}
        </h1>
        {!isCurrentMonth && (
          <button
            onClick={goToday}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
          >
            {t("day.today")}
          </button>
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center justify-center gap-1 flex-1 min-w-0">
          <button onClick={prev} className="btn btn-ghost p-2" aria-label={t("cal.prevMonth")}>
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium w-40 text-center" aria-live="polite">{monthName}</span>
          <button onClick={next} className="btn btn-ghost p-2" aria-label={t("cal.nextMonth")}>
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-1 pt-1 shrink-0 text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            {t("cal.tasks")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary/40" />
            {t("cal.plans")}
          </span>
        </div>
      </div>

      <div ref={calendarViewportRef} className="overflow-hidden -mx-1.5">
        <motion.div
          style={{ x: calendarX }}
          drag={isMobile && calendarWidth > 0 ? "x" : false}
          dragConstraints={{ left: -calendarWidth * 2, right: 0 }}
          dragElastic={0.12}
          dragDirectionLock
          onDragStart={() => calendarX.stop()}
          onDragEnd={handleCalendarDragEnd}
          className="flex w-[300%] touch-pan-y"
        >
          {adjacentMonths.map((month, index) => (
            <div key={`${month.year}-${month.month}`} className="w-1/3 shrink-0 px-1.5">
              {renderMonthGrid(month, index === 1)}
            </div>
          ))}
        </motion.div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: stats.daysTracked, label: t("cal.daysTracked") },
            { value: stats.totalTasks, label: t("cal.totalTasks") },
            { value: stats.streak, label: t("cal.dayStreak") },
          ].map(({ value, label }, index) => (
            <motion.div
              key={label}
              initial={shouldAnimateSummary ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              onAnimationComplete={() => { summaryAnimatedRef.current = true; }}
              transition={{ delay: shouldAnimateSummary ? index * 0.05 : 0 }}
              className="card text-center"
            >
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-text-secondary mt-1">{label}</p>
            </motion.div>
          ))}
        </div>
      )}

    </div>
  );
}
