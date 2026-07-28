import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Target, Check, MessageSquare, Bell } from "lucide-react";
import { formatDuration, todayStr, type DayLog } from "@gmd/shared";
import { useCategories } from "@/hooks/useCategories";
import { motion } from "framer-motion";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDates(ref: Date): string[] {
  const d = new Date(ref);
  const day = d.getDay();
  // ISO week: Mon–Sun. Sunday (0) is treated as day 7 so it falls at end of week.
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(d);
    date.setDate(d.getDate() + i);
    return localDateStr(date);
  });
}

interface DragInfo {
  fromDate: string;
  itemId: string;
  itemType: "task" | "plan";
}

export default function WeekView() {
  const { t, locale } = useI18n();
  const { getCategoryColor } = useCategories();
  const [weekRef, setWeekRef] = useState(() => new Date());
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = todayStr();
  const dateLoc = locale === "tr" ? "tr-TR" : "en-US";

  const touchDragRef = useRef<DragInfo | null>(null);
  const touchGhostRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragOverDateRef = useRef<string | null>(null);
  // The week strip scrolls horizontally; while dragging a card we lock that scroll
  // so dragging Tue→Mon doesn't also swipe the days left/right.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lockWeekScroll = (lock: boolean) => {
    if (scrollRef.current) scrollRef.current.style.overflowX = lock ? "hidden" : "";
  };

  const dates = useMemo(() => getWeekDates(weekRef), [weekRef]);

  const weekLabel = useMemo(() => {
    const start = new Date(dates[0] + "T12:00:00");
    const end = new Date(dates[6] + "T12:00:00");
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.toLocaleDateString(dateLoc, { month: "long", day: "numeric" })} – ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString(dateLoc, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(dateLoc, { month: "short", day: "numeric", year: "numeric" })}`;
  }, [dates, dateLoc]);

  const dayQueries = useQueries({
    queries: dates.map((date) => ({
      queryKey: ["daylog", date],
      queryFn: () => api.getDayLog(date),
      staleTime: 30_000,
    })),
  });

  const prevWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  const goToday = () => setWeekRef(new Date());

  const isCurrentWeek = dates.includes(today);
  const moveItem = useCallback(async (info: DragInfo, toDate: string) => {
    if (info.fromDate === toDate) return;

    const fromKey = ["daylog", info.fromDate];
    const toKey = ["daylog", toDate];

    await qc.cancelQueries({ queryKey: fromKey });
    await qc.cancelQueries({ queryKey: toKey });
    const prevFrom = qc.getQueryData<DayLog>(fromKey);
    const prevTo = qc.getQueryData<DayLog>(toKey);

    // Optimistic: remove from source, add to target
    if (prevFrom) {
      if (info.itemType === "plan") {
        const item = prevFrom.plan.find((p) => p.id === info.itemId);
        if (item) {
          qc.setQueryData<DayLog>(fromKey, { ...prevFrom, plan: prevFrom.plan.filter((p) => p.id !== info.itemId) });
          if (prevTo) {
            qc.setQueryData<DayLog>(toKey, { ...prevTo, plan: [...prevTo.plan, { ...item, order: prevTo.plan.length }] });
          }
        }
      } else {
        const item = prevFrom.tasks.find((t) => t.id === info.itemId);
        if (item) {
          qc.setQueryData<DayLog>(fromKey, { ...prevFrom, tasks: prevFrom.tasks.filter((t) => t.id !== info.itemId) });
          if (prevTo) {
            qc.setQueryData<DayLog>(toKey, { ...prevTo, tasks: [...prevTo.tasks, item] });
          }
        }
      }
    }

    try {
      if (info.itemType === "plan") {
        await api.movePlan(info.fromDate, info.itemId, toDate);
      } else {
        await api.moveTask(info.fromDate, info.itemId, toDate);
      }
    } catch {
      if (prevFrom) qc.setQueryData(fromKey, prevFrom);
      if (prevTo) qc.setQueryData(toKey, prevTo);
    }
    qc.invalidateQueries({ queryKey: fromKey });
    qc.invalidateQueries({ queryKey: toKey });
  }, [qc]);

  const handleDragStart = (e: React.DragEvent, fromDate: string, itemId: string, itemType: "task" | "plan") => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ fromDate, itemId, itemType }));
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(date);
  };
  const handleDragLeave = () => setDragOverDate(null);
  const handleDrop = async (e: React.DragEvent, toDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain")) as DragInfo;
      moveItem(data, toDate);
    } catch { /* ignore */ }
  };

  const cleanupTouchDrag = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    if (touchGhostRef.current) { touchGhostRef.current.remove(); touchGhostRef.current = null; }
    lockWeekScroll(false);
    touchDragRef.current = null;
    touchStartPos.current = null;
    dragOverDateRef.current = null;
    setDragOverDate(null);
  }, []);

  useEffect(() => () => cleanupTouchDrag(), [cleanupTouchDrag]);

  useEffect(() => {
    const prevent = (e: Event) => {
      if (touchDragRef.current || longPressTimerRef.current) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", prevent, { passive: false });
    return () => document.removeEventListener("contextmenu", prevent);
  }, []);

  const findDateFromPoint = useCallback((x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const dayCol = (el as HTMLElement).closest("[data-date]");
    return dayCol?.getAttribute("data-date") || null;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, fromDate: string, itemId: string, itemType: "task" | "plan", label: string) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = setTimeout(() => {
      touchDragRef.current = { fromDate, itemId, itemType };
      const ghost = document.createElement("div");
      ghost.setAttribute("data-drag-ghost", "");
      ghost.className = "fixed z-[999] px-3 py-1.5 rounded-lg bg-accent text-bg text-xs font-medium shadow-lg pointer-events-none";
      ghost.textContent = label;
      ghost.style.left = `${touch.clientX - 40}px`;
      ghost.style.top = `${touch.clientY - 20}px`;
      document.body.appendChild(ghost);
      touchGhostRef.current = ghost;
      lockWeekScroll(true);
      navigator.vibrate?.(30);
    }, 400);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touchDragRef.current && touchStartPos.current) {
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
        return;
      }
    }
    if (!touchDragRef.current) return;
    e.preventDefault();
    if (touchGhostRef.current) {
      touchGhostRef.current.style.left = `${touch.clientX - 40}px`;
      touchGhostRef.current.style.top = `${touch.clientY - 20}px`;
    }
    const date = findDateFromPoint(touch.clientX, touch.clientY);
    const over = date && date !== touchDragRef.current.fromDate ? date : null;
    dragOverDateRef.current = over;
    setDragOverDate(over);
  }, [findDateFromPoint]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    const info = touchDragRef.current;
    const target = dragOverDateRef.current;
    if (info && target) moveItem(info, target);
    cleanupTouchDrag();
    document.querySelectorAll("[data-drag-ghost]").forEach((el) => el.remove());
  }, [moveItem, cleanupTouchDrag]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <CalendarDays size={20} className="text-text-secondary" />
          <span className="hidden sm:inline">{t("week.title")}</span>
        </h1>
        <div className="flex items-center gap-1">
          {!isCurrentWeek && (
            <button onClick={goToday} className="btn btn-ghost text-xs mr-1">{t("week.thisWeek")}</button>
          )}
          <button onClick={prevWeek} className="btn btn-ghost p-2" aria-label={t("week.prevWeek")}>
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs sm:text-sm font-medium text-center min-w-[140px] sm:min-w-[200px]">{weekLabel}</span>
          <button onClick={nextWeek} className="btn btn-ghost p-2" aria-label={t("week.nextWeek")}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Week grid */}
      <div>
      <div ref={scrollRef} className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(7, minmax(110px, 1fr))" }}>
        {dates.map((date, i) => {
          const dayLog = dayQueries[i].data;
          const isLoading = dayQueries[i].isLoading;
          const isToday = date === today;
          const d = new Date(date + "T12:00:00");
          const dayName = d.toLocaleDateString(dateLoc, { weekday: "short" });
          const dayNum = d.getDate();
          const isFuture = date > today;
          const isDragOver = dragOverDate === date;

          const allPlans = dayLog?.plan || [];
          const sortedPlans = allPlans
            .filter((p) => p.itemType !== "reminder")
            .sort((a, b) => {
              if (a.scheduledTime && b.scheduledTime) return a.scheduledTime.localeCompare(b.scheduledTime);
              if (a.scheduledTime) return -1;
              if (b.scheduledTime) return 1;
              return a.order - b.order;
            });
          const reminders = allPlans
            .filter((p) => p.itemType === "reminder")
            .sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""));
          const tasks = dayLog?.tasks || [];
          const isEmpty = sortedPlans.length === 0 && reminders.length === 0 && tasks.length === 0;

          return (
            <div
              key={date}
              data-date={date}
              onDragOver={(e) => handleDragOver(e, date)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, date)}
              className={cn(
                "flex flex-col rounded-xl border transition-all min-h-[160px]",
                isToday
                  ? "border-accent bg-accent-soft/30 shadow-sm"
                  : isDragOver
                    ? "border-accent/50 bg-accent-soft/10 shadow-md"
                    : "border-border bg-bg-elevated",
                isFuture && !isDragOver && "opacity-60"
              )}
            >
              <button
                onClick={() => navigate(`/day/${date}`)}
                className={cn(
                  "px-2.5 py-2 text-center border-b transition-colors hover:bg-bg-tertiary rounded-t-xl",
                  isToday ? "border-accent/20" : "border-border"
                )}
              >
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{dayName}</p>
                <p className={cn("text-lg font-semibold leading-tight", isToday ? "text-accent" : "text-text")}>
                  {dayNum}
                </p>
              </button>

              <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
                {isLoading && (
                  <div className="space-y-1.5 p-1">
                    {[1, 2].map((j) => (
                      <div key={j} className="h-6 bg-bg-tertiary rounded animate-pulse" />
                    ))}
                  </div>
                )}

                {isEmpty && dayLog && (
                  <button
                    onClick={() => navigate(`/day/${date}`)}
                    className="w-full h-full flex items-center justify-center text-text-tertiary/30 hover:text-text-tertiary/60 transition-colors"
                  >
                    <span className="text-[10px]">{t("week.empty")}</span>
                  </button>
                )}

                {sortedPlans.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    draggable
                    onDragStart={(e) => handleDragStart(e as any, date, item.id, "plan")}
                    onTouchStart={(e) => handleTouchStart(e, date, item.id, "plan", item.description)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                    onClick={() => navigate(`/day/${date}`)}
                    className={cn(
                      "px-1.5 py-1 rounded-md text-[10px] leading-tight cursor-grab active:cursor-grabbing",
                      "hover:opacity-80 transition-opacity border-l-2 select-none touch-manipulation",
                      item.completed && "opacity-40"
                    )}
                    style={{ borderLeftColor: getCategoryColor(item.category) }}
                  >
                    {item.scheduledTime && (
                      <div className="flex items-center gap-0.5 text-text-tertiary mb-0.5">
                        <Clock size={7} />
                        <span className="font-medium">{item.scheduledTime}</span>
                        {item.duration != null && item.duration > 0 && (
                          <span className="ml-auto opacity-70">~{formatDuration(item.duration)}</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      {item.completed ? (
                        <Check size={8} className="text-success flex-shrink-0" />
                      ) : (
                        <Target size={8} className="text-text-tertiary flex-shrink-0" />
                      )}
                      <span className={cn("truncate", item.completed && "line-through text-text-tertiary")}>
                        {item.description}
                      </span>
                    </div>
                    {!item.scheduledTime && item.duration != null && item.duration > 0 && (
                      <div className="flex items-center gap-0.5 mt-0.5 text-text-tertiary">
                        <span>~{formatDuration(item.duration)}</span>
                      </div>
                    )}
                  </motion.div>
                ))}

                {reminders.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/day/${date}`)}
                    className="px-1.5 py-1 rounded-md text-[10px] leading-tight border-l-2 border-accent/60 bg-accent-soft/20 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-0.5 text-accent">
                      <Bell size={7} />
                      {item.scheduledTime && <span className="font-medium">{item.scheduledTime}</span>}
                    </div>
                    <span className="truncate block text-text-secondary">{item.description}</span>
                  </div>
                ))}

                {tasks.length > 0 && (sortedPlans.length > 0 || reminders.length > 0) && (
                  <div className="border-t border-border/50 my-1" />
                )}
                {tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    draggable
                    onDragStart={(e) => handleDragStart(e as any, date, task.id, "task")}
                    onTouchStart={(e) => handleTouchStart(e, date, task.id, "task", task.description)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                    onClick={() => navigate(`/day/${date}`)}
                    className={cn(
                      "px-1.5 py-0.5 rounded-md text-[10px] leading-tight cursor-grab active:cursor-grabbing",
                      "hover:opacity-80 transition-opacity select-none touch-manipulation text-text-secondary"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <MessageSquare size={7} className="text-text-tertiary flex-shrink-0" />
                      <span className="truncate">{task.description}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </div>
      </div>
    </div>
  );
}
