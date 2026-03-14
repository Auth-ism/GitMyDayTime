import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Target, Check } from "lucide-react";
import { CATEGORY_COLORS, formatDuration, type DayLog } from "@gmd/shared";
import { motion } from "framer-motion";

function getWeekDates(ref: Date): string[] {
  const d = new Date(ref);
  const day = d.getDay();
  d.setDate(d.getDate() - day + 1); // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(d);
    date.setDate(d.getDate() + i);
    return date.toISOString().split("T")[0];
  });
}

function getWeekLabel(dates: string[]): string {
  const start = new Date(dates[0] + "T12:00:00");
  const end = new Date(dates[6] + "T12:00:00");
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export default function WeekView() {
  const [weekRef, setWeekRef] = useState(() => new Date());
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const todayStr = new Date().toISOString().split("T")[0];

  const dates = useMemo(() => getWeekDates(weekRef), [weekRef]);
  const weekLabel = useMemo(() => getWeekLabel(dates), [dates]);

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

  const isCurrentWeek = dates.includes(todayStr);

  const handleDragStart = (e: React.DragEvent, fromDate: string, itemId: string, itemType: "task" | "plan") => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ fromDate, itemId, itemType }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(date);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = async (e: React.DragEvent, toDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      const { fromDate, itemId, itemType } = data as { fromDate: string; itemId: string; itemType: "task" | "plan" };

      if (fromDate === toDate) return;

      if (itemType === "plan") {
        await api.movePlan(fromDate, itemId, toDate);
      } else {
        await api.moveTask(fromDate, itemId, toDate);
      }

      // Invalidate both source and target day queries
      qc.invalidateQueries({ queryKey: ["daylog", fromDate] });
      qc.invalidateQueries({ queryKey: ["daylog", toDate] });
    } catch {
      // ignore invalid drops
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <CalendarDays size={20} className="text-text-secondary" />
          Week
        </h1>
        <div className="flex items-center gap-1.5">
          {!isCurrentWeek && (
            <button onClick={goToday} className="btn btn-ghost text-xs mr-1">This week</button>
          )}
          <button onClick={prevWeek} className="btn btn-ghost p-2" aria-label="Previous week">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-center min-w-[200px]">{weekLabel}</span>
          <button onClick={nextWeek} className="btn btn-ghost p-2" aria-label="Next week">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-2">
        {dates.map((date, i) => {
          const dayLog = dayQueries[i].data;
          const isLoading = dayQueries[i].isLoading;
          const isToday = date === todayStr;
          const d = new Date(date + "T12:00:00");
          const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
          const dayNum = d.getDate();
          const isFuture = date > todayStr;
          const isDragOver = dragOverDate === date;

          return (
            <div
              key={date}
              onDragOver={(e) => handleDragOver(e, date)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, date)}
              className={cn(
                "flex flex-col rounded-xl border transition-all min-h-[280px]",
                isToday
                  ? "border-accent bg-accent-soft/30"
                  : isDragOver
                  ? "border-accent/50 bg-accent-soft/10 shadow-md"
                  : "border-border bg-bg-elevated",
                isFuture && !isDragOver && "opacity-60"
              )}
            >
              {/* Day header */}
              <button
                onClick={() => navigate(`/day/${date}`)}
                className={cn(
                  "px-2.5 py-2 text-center border-b transition-colors hover:bg-bg-tertiary rounded-t-xl",
                  isToday ? "border-accent/20" : "border-border"
                )}
              >
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{dayName}</p>
                <p className={cn(
                  "text-lg font-semibold leading-tight",
                  isToday ? "text-accent" : "text-text"
                )}>
                  {dayNum}
                </p>
              </button>

              {/* Items */}
              <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
                {isLoading && (
                  <div className="space-y-1.5 p-1">
                    {[1, 2].map((j) => (
                      <div key={j} className="h-6 bg-bg-tertiary rounded animate-pulse" />
                    ))}
                  </div>
                )}
                {dayLog && <DayCards dayLog={dayLog} date={date} onNavigate={() => navigate(`/day/${date}`)} onDragStart={handleDragStart} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayCards({
  dayLog,
  date,
  onNavigate,
  onDragStart,
}: {
  dayLog: DayLog;
  date: string;
  onNavigate: () => void;
  onDragStart: (e: React.DragEvent, fromDate: string, itemId: string, itemType: "task" | "plan") => void;
}) {
  const plans = [...dayLog.plan].sort((a, b) => {
    // Sort by scheduled time first, then by order
    if (a.scheduledTime && b.scheduledTime) return a.scheduledTime.localeCompare(b.scheduledTime);
    if (a.scheduledTime) return -1;
    if (b.scheduledTime) return 1;
    return a.order - b.order;
  });
  const tasks = dayLog.tasks;
  const isEmpty = plans.length === 0 && tasks.length === 0;

  if (isEmpty) {
    return (
      <button
        onClick={onNavigate}
        className="w-full h-full flex items-center justify-center text-text-tertiary/40 hover:text-text-tertiary transition-colors"
      >
        <span className="text-[10px]">Empty</span>
      </button>
    );
  }

  return (
    <>
      {plans.map((item) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          draggable
          onDragStart={(e) => onDragStart(e as any, date, item.id, "plan")}
          className={cn(
            "px-1.5 py-1 rounded-md text-[10px] leading-tight cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity border-l-2",
            item.completed ? "opacity-50" : ""
          )}
          style={{ borderLeftColor: CATEGORY_COLORS[item.category] }}
          onClick={onNavigate}
        >
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
          {(item.scheduledTime || (item.estimatedDuration != null && item.estimatedDuration > 0)) && (
            <div className="flex items-center gap-1 mt-0.5 text-text-tertiary">
              {item.scheduledTime && (
                <>
                  <Clock size={7} />
                  <span>{item.scheduledTime}</span>
                </>
              )}
              {item.estimatedDuration != null && item.estimatedDuration > 0 && (
                <span className="ml-auto">~{formatDuration(item.estimatedDuration)}</span>
              )}
            </div>
          )}
        </motion.div>
      ))}
      {tasks.map((task) => (
        <motion.div
          key={task.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          draggable
          onDragStart={(e) => onDragStart(e as any, date, task.id, "task")}
          className={cn(
            "px-1.5 py-1 rounded-md text-[10px] leading-tight cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity border-l-2 bg-bg-secondary/50",
            task.completed ? "opacity-50" : ""
          )}
          style={{ borderLeftColor: "#6b7280" }}
          onClick={onNavigate}
        >
          <div className="flex items-center gap-1">
            {task.completed && <Check size={8} className="text-accent flex-shrink-0" />}
            <span className={cn("truncate", task.completed && "line-through text-text-tertiary")}>
              {task.description}
            </span>
          </div>
          {task.duration != null && task.duration > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5 text-text-tertiary">
              <Clock size={7} />
              <span>{formatDuration(task.duration)}</span>
            </div>
          )}
        </motion.div>
      ))}
    </>
  );
}
