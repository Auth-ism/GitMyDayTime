import { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Target, Check, MessageSquare, Bell } from "lucide-react";
import { formatDuration, todayStr, type DayLog } from "@gmd/shared";
import { useCategories } from "@/hooks/useCategories";
import { animate, motion, useMotionValue, type PanInfo } from "framer-motion";

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
  const slidingRef = useRef(false);
  const weekViewportRef = useRef<HTMLDivElement>(null);
  const weekWidthRef = useRef(0);
  const [weekWidth, setWeekWidth] = useState(0);
  const weekX = useMotionValue(0);
  // The week strip scrolls horizontally; while dragging a card we lock that scroll
  // so dragging Tue→Mon doesn't also swipe the days left/right.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lockWeekScroll = (lock: boolean) => {
    if (scrollRef.current) scrollRef.current.style.overflowX = lock ? "hidden" : "";
  };

  const weekPanels = useMemo(() => [-7, 0, 7].map((offset) => {
    const ref = new Date(weekRef);
    ref.setDate(ref.getDate() + offset);
    return getWeekDates(ref);
  }), [weekRef]);
  const dates = weekPanels[1];

  useLayoutEffect(() => {
    const viewport = weekViewportRef.current;
    if (!viewport) return;

    const syncWidth = () => {
      const width = viewport.clientWidth;
      if (!width || width === weekWidthRef.current) return;
      weekWidthRef.current = width;
      setWeekWidth(width);
      if (!slidingRef.current) weekX.set(-width);
    };

    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [weekX]);

  const weekLabel = useMemo(() => {
    const start = new Date(dates[0] + "T12:00:00");
    const end = new Date(dates[6] + "T12:00:00");
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.toLocaleDateString(dateLoc, { month: "long", day: "numeric" })} – ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString(dateLoc, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(dateLoc, { month: "short", day: "numeric", year: "numeric" })}`;
  }, [dates, dateLoc]);

  const allDates = weekPanels.flat();
  const dayQueries = useQueries({
    queries: allDates.map((date) => ({
      queryKey: ["daylog", date],
      queryFn: () => api.getDayLog(date),
      staleTime: 30_000,
    })),
  });

  const prevWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  const paginate = async (direction: -1 | 1) => {
    const width = weekWidthRef.current;
    if (slidingRef.current || !width) return;
    slidingRef.current = true;
    weekX.stop();
    const target = direction === 1 ? -width * 2 : 0;
    const animation = animate(weekX, target, { type: "spring", stiffness: 420, damping: 38 });
    await (animation as typeof animation & { finished: Promise<unknown> }).finished;
    flushSync(() => {
      setWeekRef((d) => {
        const next = new Date(d);
        next.setDate(next.getDate() + direction * 7);
        return next;
      });
      weekX.set(-width);
    });
    slidingRef.current = false;
  };
  const prev = () => { void paginate(-1); };
  const next = () => { void paginate(1); };
  const goToday = () => {
    weekX.stop();
    if (weekWidthRef.current) weekX.set(-weekWidthRef.current);
    setWeekRef(new Date());
  };

  const isCurrentWeek = dates.includes(today);
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
  const handleWeekDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const width = weekWidthRef.current;
    if (!isMobile || slidingRef.current || !width) return;
    const threshold = Math.max(70, width * 0.2);
    if (info.offset.x <= -threshold || info.velocity.x <= -500) {
      void paginate(1);
    } else if (info.offset.x >= threshold || info.velocity.x >= 500) {
      void paginate(-1);
    } else {
      slidingRef.current = true;
      weekX.stop();
      void (animate(weekX, -width, { type: "spring", stiffness: 420, damping: 38 }) as ReturnType<typeof animate> & { finished: Promise<unknown> }).finished
        .finally(() => { slidingRef.current = false; });
    }
  };
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
          <button
            onClick={() => navigate("/calendar")}
            className="btn-icon p-1.5 rounded-lg -ml-1"
            aria-label={t("nav.calendar" as any)}
          >
            <CalendarDays size={20} />
          </button>
          {t("week.title")}
        </h1>
        {!isCurrentWeek && (
          <button onClick={goToday} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors">
            {t("week.thisWeek")}
          </button>
        )}
      </div>
      <div className="flex items-center justify-center gap-1">
        <button onClick={prev} className="btn btn-ghost p-2" aria-label={t("week.prevWeek")}>
          <ChevronLeft size={18} />
        </button>
        <span className="text-xs sm:text-sm font-medium text-center min-w-[140px] sm:min-w-[200px]">{weekLabel}</span>
        <button onClick={next} className="btn btn-ghost p-2" aria-label={t("week.nextWeek")}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Week grid */}
      <div ref={weekViewportRef} className="overflow-hidden -mx-1.5">
        <motion.div
          style={{ x: weekX }}
          drag={isMobile && weekWidth > 0 ? "x" : false}
          dragConstraints={{ left: -weekWidth * 2, right: 0 }}
          dragElastic={0.12}
          dragDirectionLock
          onDragStart={() => weekX.stop()}
          onDragEnd={handleWeekDragEnd}
          className="flex w-[300%] touch-pan-y"
        >
        {weekPanels.map((panelDates, panelIndex) => (
          <div key={panelDates[0]} className={cn("w-1/3 shrink-0 px-1.5", panelIndex !== 1 && "pointer-events-none")}>
          <div>
          <div ref={panelIndex === 1 ? scrollRef : undefined} className="-mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:overflow-x-auto">
          <div className="grid grid-cols-2 gap-2 sm:[grid-template-columns:repeat(7,minmax(110px,1fr))]">
        {panelDates.map((date, i) => {
          const dayQuery = dayQueries[panelIndex * 7 + i];
          const dayLog = dayQuery.data;
          const isLoading = dayQuery.isLoading;
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
        ))}
        </motion.div>
      </div>
    </div>
  );
}
